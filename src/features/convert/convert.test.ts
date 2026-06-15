import { describe, it, expect } from 'vitest';
import type { ERDSchema, Table, Column, Relationship } from '@/types/schema';
import { prismaConverter } from './prisma';
import { dbmlConverter } from './dbml';
import { converterRegistry } from './registry';

// ── 헤드리스 fixture: User 1:N Post ────────────────────────────────────
// FK 방향 규약: source = 참조(PK) 측, target = FK 보유 측 (sql-parser 와 동일)

function makeColumn(partial: Partial<Column> & { name: string; dataType: string }): Column {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    dataType: partial.dataType,
    nullable: partial.nullable ?? false,
    autoIncrement: partial.autoIncrement ?? false,
    isPrimaryKey: partial.isPrimaryKey ?? false,
    isUnique: partial.isUnique ?? false,
    defaultValue: partial.defaultValue,
    length: partial.length,
  };
}

function buildFixture(): ERDSchema {
  const userId = makeColumn({ id: 'u_id', name: 'id', dataType: 'INT', isPrimaryKey: true, autoIncrement: true });
  const userEmail = makeColumn({ id: 'u_email', name: 'email', dataType: 'VARCHAR', length: 255, isUnique: true });
  const userName = makeColumn({ id: 'u_name', name: 'name', dataType: 'VARCHAR', nullable: true });

  const postId = makeColumn({ id: 'p_id', name: 'id', dataType: 'INT', isPrimaryKey: true, autoIncrement: true });
  const postTitle = makeColumn({ id: 'p_title', name: 'title', dataType: 'VARCHAR', length: 255 });
  const postUserId = makeColumn({ id: 'p_user_id', name: 'user_id', dataType: 'INT' });

  const user: Table = { id: 'tbl_user', name: 'User', columns: [userId, userEmail, userName], indexes: [] };
  const post: Table = { id: 'tbl_post', name: 'Post', columns: [postId, postTitle, postUserId], indexes: [] };

  const rel: Relationship = {
    id: 'rel_user_post',
    name: 'fk_post_user',
    sourceTableId: 'tbl_user', // 참조(PK) 측
    targetTableId: 'tbl_post', // FK 보유 측
    type: '1:N',
    sourceColumnIds: ['u_id'],
    targetColumnIds: ['p_user_id'],
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  };

  return {
    tables: { tbl_user: user, tbl_post: post },
    relationships: { rel_user_post: rel },
    layers: {},
  };
}

// 이름 기준 동치 비교 헬퍼(ID 는 nanoid 라 비결정적 — 구조/이름으로 비교)
interface NormalTable {
  name: string;
  columns: Array<{ name: string; isPrimaryKey: boolean; isUnique: boolean; nullable: boolean }>;
}
function normalizeTables(schema: ERDSchema): NormalTable[] {
  return Object.values(schema.tables)
    .map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        isPrimaryKey: c.isPrimaryKey,
        isUnique: c.isUnique,
        nullable: c.nullable,
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface NormalRel {
  sourceTable: string;
  targetTable: string;
  sourceCols: string[];
  targetCols: string[];
  type: string;
}
function normalizeRels(schema: ERDSchema): NormalRel[] {
  return Object.values(schema.relationships)
    .map((r) => {
      const src = schema.tables[r.sourceTableId];
      const tgt = schema.tables[r.targetTableId];
      return {
        sourceTable: src?.name ?? r.sourceTableId,
        targetTable: tgt?.name ?? r.targetTableId,
        sourceCols: r.sourceColumnIds.map((id) => src?.columns.find((c) => c.id === id)?.name ?? id),
        targetCols: r.targetColumnIds.map((id) => tgt?.columns.find((c) => c.id === id)?.name ?? id),
        type: r.type,
      };
    })
    .sort((a, b) => (a.sourceTable + a.targetTable).localeCompare(b.sourceTable + b.targetTable));
}

// ── Prisma ─────────────────────────────────────────────────────────────
describe('prismaConverter', () => {
  it('generate: model 블록과 스칼라/@id/@unique/@relation 을 만든다', () => {
    const out = prismaConverter.generate!(buildFixture());
    expect(out).toContain('model User {');
    expect(out).toContain('model Post {');
    expect(out).toContain('@id');
    expect(out).toContain('@unique');
    expect(out).toContain('@relation');
    // 스칼라 매핑: INT→Int, VARCHAR→String
    expect(out).toMatch(/id\s+Int/);
    expect(out).toMatch(/email\s+String/);
    // autoIncrement → @default(autoincrement())
    expect(out).toContain('autoincrement()');
  });

  it('parse: model/필드/@relation 을 ERDSchema 로 되돌린다', () => {
    const out = prismaConverter.generate!(buildFixture());
    const { schema, warnings } = prismaConverter.parse!(out);
    expect(Object.keys(schema.tables)).toHaveLength(2);
    expect(warnings).toBeInstanceOf(Array);

    const tables = normalizeTables(schema);
    const post = tables.find((t) => t.name === 'Post')!;
    expect(post).toBeDefined();
    const idCol = post.columns.find((c) => c.name === 'id')!;
    expect(idCol.isPrimaryKey).toBe(true);
    const user = tables.find((t) => t.name === 'User')!;
    const emailCol = user.columns.find((c) => c.name === 'email')!;
    expect(emailCol.isUnique).toBe(true);
  });

  it('roundtrip: 핵심 구조(테이블/PK/관계 방향) 가 보존된다', () => {
    const original = buildFixture();
    const out = prismaConverter.generate!(original);
    const { schema } = prismaConverter.parse!(out);

    expect(normalizeTables(schema)).toEqual(normalizeTables(original));

    const rels = normalizeRels(schema);
    expect(rels).toHaveLength(1);
    // FK 방향 규약 보존: source=User(PK), target=Post(FK)
    expect(rels[0].sourceTable).toBe('User');
    expect(rels[0].targetTable).toBe('Post');
    expect(rels[0].sourceCols).toEqual(['id']);
    expect(rels[0].targetCols).toEqual(['user_id']);
  });
});

// ── DBML ────────────────────────────────────────────────────────────────
describe('dbmlConverter', () => {
  it('generate: Table/컬럼 settings/Ref 를 만든다', () => {
    const out = dbmlConverter.generate!(buildFixture());
    expect(out).toContain('Table User {');
    expect(out).toContain('Table Post {');
    expect(out).toContain('[pk');
    expect(out).toContain('unique');
    expect(out).toContain('Ref');
    // 스칼라 매핑: INT→int, VARCHAR→varchar
    expect(out).toMatch(/id\s+int/);
  });

  it('parse: Table/Ref 를 ERDSchema 로 되돌린다', () => {
    const out = dbmlConverter.generate!(buildFixture());
    const { schema, warnings } = dbmlConverter.parse!(out);
    expect(Object.keys(schema.tables)).toHaveLength(2);
    expect(warnings).toBeInstanceOf(Array);
    expect(Object.keys(schema.relationships)).toHaveLength(1);
  });

  it('roundtrip: 핵심 구조(테이블/PK/unique/관계 방향) 가 보존된다', () => {
    const original = buildFixture();
    const out = dbmlConverter.generate!(original);
    const { schema } = dbmlConverter.parse!(out);

    expect(normalizeTables(schema)).toEqual(normalizeTables(original));

    const rels = normalizeRels(schema);
    expect(rels).toHaveLength(1);
    expect(rels[0].sourceTable).toBe('User');
    expect(rels[0].targetTable).toBe('Post');
    expect(rels[0].sourceCols).toEqual(['id']);
    expect(rels[0].targetCols).toEqual(['user_id']);
  });
});

// ── 대표 fixture 스냅샷 ──────────────────────────────────────────────────
describe('representative snapshots', () => {
  it('prisma generate snapshot', () => {
    expect(prismaConverter.generate!(buildFixture())).toMatchSnapshot();
  });
  it('dbml generate snapshot', () => {
    expect(dbmlConverter.generate!(buildFixture())).toMatchSnapshot();
  });
});

// ── 레지스트리 배선 ──────────────────────────────────────────────────────
describe('converterRegistry', () => {
  it('prisma/dbml 변환기가 등록되어 있다', () => {
    expect(converterRegistry.get('prisma')).toBeDefined();
    expect(converterRegistry.get('dbml')).toBeDefined();
    const ids = converterRegistry.list().map((c) => c.id);
    expect(ids).toContain('prisma');
    expect(ids).toContain('dbml');
  });

  it('등록된 양방향 변환기는 parse 와 generate 를 모두 가진다', () => {
    for (const id of ['prisma', 'dbml']) {
      const c = converterRegistry.get(id)!;
      expect(c.direction).toBe('both');
      expect(typeof c.parse).toBe('function');
      expect(typeof c.generate).toBe('function');
    }
  });
});
