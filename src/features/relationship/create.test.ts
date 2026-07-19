// createRelationship contract — the shared source for REL MODE and drag-connect.
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';
import { createRelationship, pickRelationshipColumns } from './create';

beforeEach(() => {
  useStore.getState().resetSchema();
});

function seed() {
  const users = useStore.getState().addTable({
    name: 'users',
    columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true } as never],
  });
  const orders = useStore.getState().addTable({
    name: 'orders',
    columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true } as never],
  });
  return { users, orders };
}

describe('createRelationship', () => {
  it('creates a 1:N relationship and auto-creates the FK column on the target', () => {
    const { users, orders } = seed();
    const r = createRelationship(useStore as never, users, orders, '1:N');
    expect(r.ok).toBe(true);
    expect(r.relId).toBeTruthy();
    // FK 컬럼 users_id 가 orders 에 생성됐다.
    const fk = useStore.getState().tables[orders].columns.find((c) => c.name === 'users_id');
    expect(fk).toBeTruthy();
    expect(fk!.dataType).toBe('INT'); // 소스 PK 타입 계승
    // 관계가 방향대로 등록됐다.
    const rel = useStore.getState().relationships[r.relId!];
    expect(rel.sourceTableId).toBe(users);
    expect(rel.targetTableId).toBe(orders);
    expect(rel.type).toBe('1:N');
  });

  it('reuses an existing FK column instead of duplicating it', () => {
    const { users } = seed();
    const orders = useStore.getState().addTable({
      name: 'orders',
      columns: [
        { name: 'id', dataType: 'INT', isPrimaryKey: true } as never,
        { name: 'users_id', dataType: 'INT' } as never,
      ],
    });
    const before = useStore.getState().tables[orders].columns.length;
    const r = createRelationship(useStore as never, users, orders, '1:N');
    expect(r.ok).toBe(true);
    expect(useStore.getState().tables[orders].columns.length).toBe(before); // no new column
  });

  it('rejects a self relationship', () => {
    const { users } = seed();
    const r = createRelationship(useStore as never, users, users, '1:N');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('SAME_TABLE');
  });

  it('rejects a missing table', () => {
    const { users } = seed();
    const r = createRelationship(useStore as never, users, 'nope', '1:N');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('MISSING_TABLE');
  });

  it('rejects when the source has no columns to reference', () => {
    const empty = useStore.getState().addTable({ name: 'empty', columns: [] });
    const other = useStore.getState().addTable({
      name: 'other',
      columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true } as never],
    });
    const r = createRelationship(useStore as never, empty, other, '1:N');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('NO_SOURCE_COLUMN');
  });

  it('mode 1:1 yields a 1:1 solid relationship; identifying modes use solid lines', () => {
    const { users, orders } = seed();
    const r = createRelationship(useStore as never, users, orders, '1|1');
    const rel = useStore.getState().relationships[r.relId!];
    expect(rel.type).toBe('1:1');
    expect(rel.lineStyle).toBe('solid'); // '|' = identifying → solid
  });
});

describe('pickRelationshipColumns', () => {
  it('picks the PK as source and matches a conventionally-named FK', () => {
    const src = { name: 'users', columns: [{ id: 's1', name: 'id', isPrimaryKey: true }] };
    const tgt = { columns: [{ id: 't1', name: 'users_id' }] };
    const r = pickRelationshipColumns(src, tgt);
    expect(r.sourceColumnIds).toEqual(['s1']);
    expect(r.targetColumnIds).toEqual(['t1']);
  });

  it('returns empty target when no conventional FK exists', () => {
    const src = { name: 'users', columns: [{ id: 's1', name: 'id', isPrimaryKey: true }] };
    const tgt = { columns: [{ id: 't1', name: 'total' }] };
    expect(pickRelationshipColumns(src, tgt).targetColumnIds).toEqual([]);
  });
});
