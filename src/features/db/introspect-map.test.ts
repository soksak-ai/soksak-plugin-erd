import { describe, it, expect } from 'vitest';
import { catalogToSchema, type Catalog } from './introspect-map';
import type { Table, Relationship } from '@/types/schema';

// Sample catalog shaped exactly like the sidecar db-introspect output:
// users(id INTEGER PK AUTOINCREMENT, email UNIQUE) +
// orders(id INTEGER PK, user_id → users.id ON DELETE CASCADE, code UNIQUE) +
// composite unique index on orders(user_id, code).
const sample: Catalog = {
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INTEGER', notnull: true, pk: true, default: null },
        { name: 'email', type: 'VARCHAR(255)', notnull: true, pk: false, default: null },
        { name: 'name', type: 'TEXT', notnull: false, pk: false, default: "'anon'" },
      ],
      foreignKeys: [],
      indexes: [
        { name: 'sqlite_autoindex_users_1', unique: true, columns: ['email'] },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', notnull: true, pk: true, default: null },
        { name: 'user_id', type: 'INTEGER', notnull: true, pk: false, default: null },
        { name: 'code', type: 'VARCHAR(32)', notnull: true, pk: false, default: null },
      ],
      foreignKeys: [
        { table: 'users', from: 'user_id', to: 'id', onUpdate: 'NO ACTION', onDelete: 'CASCADE' },
      ],
      indexes: [
        { name: 'idx_orders_user_code', unique: true, columns: ['user_id', 'code'] },
      ],
    },
  ],
};

const byName = (tables: Record<string, Table>, name: string): Table =>
  Object.values(tables).find(t => t.name === name)!;

describe('catalogToSchema', () => {
  it('maps tables and columns with dataType preserved', () => {
    const { schema } = catalogToSchema(sample);
    expect(Object.keys(schema.tables)).toHaveLength(2);

    const users = byName(schema.tables, 'users');
    const email = users.columns.find(c => c.name === 'email')!;
    expect(email.dataType).toBe('VARCHAR(255)'); // 원문 유지
    expect(email.length).toBe(255); // parsed as a bonus, dataType untouched
  });

  it('reverts notnull → nullable and folds default value', () => {
    const { schema } = catalogToSchema(sample);
    const users = byName(schema.tables, 'users');
    const name = users.columns.find(c => c.name === 'name')!;
    const email = users.columns.find(c => c.name === 'email')!;
    expect(name.nullable).toBe(true); // notnull=false → nullable
    expect(email.nullable).toBe(false); // notnull=true → not nullable
    expect(name.defaultValue).toBe("'anon'");
  });

  it('detects INTEGER single-column PK as autoIncrement', () => {
    const { schema } = catalogToSchema(sample);
    const usersId = byName(schema.tables, 'users').columns.find(c => c.name === 'id')!;
    expect(usersId.isPrimaryKey).toBe(true);
    expect(usersId.autoIncrement).toBe(true);
  });

  it('folds a single-column unique index onto Column.isUnique', () => {
    const { schema } = catalogToSchema(sample);
    const users = byName(schema.tables, 'users');
    const email = users.columns.find(c => c.name === 'email')!;
    expect(email.isUnique).toBe(true);
    // Folded index does not also appear as a standalone Index.
    expect(users.indexes).toHaveLength(0);
  });

  it('keeps a multi-column unique index as an Index (not folded)', () => {
    const { schema } = catalogToSchema(sample);
    const orders = byName(schema.tables, 'orders');
    expect(orders.indexes).toHaveLength(1);
    const idx = orders.indexes[0];
    expect(idx.name).toBe('idx_orders_user_code');
    expect(idx.unique).toBe(true);
    expect(idx.columnIds).toHaveLength(2);
    const orderColIds = new Set(orders.columns.map(c => c.id));
    for (const cid of idx.columnIds) expect(orderColIds.has(cid)).toBe(true);
  });

  it('wires the FK relationship parent→child with actions', () => {
    const { schema } = catalogToSchema(sample);
    const rels = Object.values(schema.relationships);
    expect(rels).toHaveLength(1);
    const rel: Relationship = rels[0];

    const users = byName(schema.tables, 'users');
    const orders = byName(schema.tables, 'orders');
    // source = referenced (parent) table, target = FK holder (child).
    expect(rel.sourceTableId).toBe(users.id);
    expect(rel.targetTableId).toBe(orders.id);

    const usersId = users.columns.find(c => c.name === 'id')!;
    const ordersUserId = orders.columns.find(c => c.name === 'user_id')!;
    expect(rel.sourceColumnIds).toEqual([usersId.id]);
    expect(rel.targetColumnIds).toEqual([ordersUserId.id]);

    expect(rel.onDelete).toBe('CASCADE');
    expect(rel.onUpdate).toBe('NO ACTION');
    // user_id is neither unique nor PK → 1:N.
    expect(rel.type).toBe('1:N');
  });

  it('resolves an implicit FK target (to=null) to the parent PK', () => {
    const { schema } = catalogToSchema({
      tables: [
        {
          name: 'parent',
          columns: [{ name: 'pid', type: 'INTEGER', notnull: true, pk: true, default: null }],
          foreignKeys: [],
          indexes: [],
        },
        {
          name: 'child',
          columns: [
            { name: 'id', type: 'INTEGER', notnull: true, pk: true, default: null },
            { name: 'pref', type: 'INTEGER', notnull: false, pk: false, default: null },
          ],
          foreignKeys: [
            { table: 'parent', from: 'pref', to: null, onUpdate: 'NO ACTION', onDelete: 'NO ACTION' },
          ],
          indexes: [],
        },
      ],
    });
    const rel = Object.values(schema.relationships)[0];
    const parent = byName(schema.tables, 'parent');
    const parentPk = parent.columns.find(c => c.name === 'pid')!;
    expect(rel.sourceColumnIds).toEqual([parentPk.id]);
  });

  it('reports losses for FK to an unknown table and for views/triggers', () => {
    const { losses } = catalogToSchema({
      tables: [
        {
          name: 't',
          columns: [{ name: 'x', type: 'INTEGER', notnull: false, pk: false, default: null }],
          foreignKeys: [
            { table: 'ghost', from: 'x', to: 'y', onUpdate: 'NO ACTION', onDelete: 'NO ACTION' },
          ],
          indexes: [],
        },
      ],
      views: [{ name: 'v_report' }],
      triggers: [{ name: 'trg_audit' }],
    });
    const kinds = losses.map(l => l.kind).sort();
    expect(kinds).toContain('foreign-key');
    expect(kinds).toContain('view');
    expect(kinds).toContain('trigger');
  });

  it('does not autoIncrement composite INTEGER primary keys', () => {
    const { schema } = catalogToSchema({
      tables: [
        {
          name: 'link',
          columns: [
            { name: 'a', type: 'INTEGER', notnull: true, pk: true, default: null },
            { name: 'b', type: 'INTEGER', notnull: true, pk: true, default: null },
          ],
          foreignKeys: [],
          indexes: [],
        },
      ],
    });
    const link = byName(schema.tables, 'link');
    for (const c of link.columns) expect(c.autoIncrement).toBe(false);
  });
});
