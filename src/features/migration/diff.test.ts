// diffSchemas 단위테스트 — 두 ERDSchema 의 차이를 Operation[] 으로 산출하는 순수함수.
// 핵심 불변: diff(before, after) 를 before 에 fold 하면 after 와 (정규형으로) 동치다.
// 헤드리스(DOM/React/Pixi 무관) — node 환경.
import { describe, it, expect } from 'vitest';
import type { ERDSchema, Table, Column, Relationship } from '@/types/schema';
import { applyOperation } from './operations';
import { serializeMig, parseMig } from './mig-dsl';
import { diffSchemas } from './diff';

// ── 테스트 픽스처 빌더(이름·id 안정) ─────────────────────────────────────────
let seq = 0;
const cid = (n: string) => `col-${n}-${seq++}`;
const tid = (n: string) => `tbl-${n}`;

function col(name: string, dataType = 'INT', extra: Partial<Column> = {}): Column {
  return {
    id: cid(name),
    name,
    dataType,
    nullable: extra.nullable ?? true,
    autoIncrement: extra.autoIncrement ?? false,
    isPrimaryKey: extra.isPrimaryKey ?? false,
    isUnique: extra.isUnique ?? false,
    defaultValue: extra.defaultValue,
    length: extra.length,
  };
}

function table(name: string, columns: Column[], id = tid(name)): Table {
  return { id, name, columns, indexes: [] };
}

function schema(tables: Table[], relationships: Relationship[] = []): ERDSchema {
  return {
    tables: Object.fromEntries(tables.map((t) => [t.id, t])),
    relationships: Object.fromEntries(relationships.map((r) => [r.id, r])),
    layers: {},
  };
}

// fold: 빈/임의 스키마에 ops 를 순차 적용.
function fold(base: ERDSchema, ops: ReturnType<typeof diffSchemas>): ERDSchema {
  let s = base;
  for (const op of ops) s = applyOperation(s, op);
  return s;
}

// 동치 비교용 정규형(id 무시 — 이름/구조만). 테이블/컬럼은 이름 정렬.
function normalize(s: ERDSchema) {
  return Object.values(s.tables)
    .map((t) => ({
      name: t.name,
      columns: [...t.columns]
        .map((c) => ({
          name: c.name,
          dataType: c.dataType,
          nullable: c.nullable,
          isPrimaryKey: c.isPrimaryKey,
          isUnique: c.isUnique,
          autoIncrement: c.autoIncrement,
          defaultValue: c.defaultValue ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

describe('diffSchemas — 빈 diff', () => {
  it('동일 스키마 diff 는 빈 배열', () => {
    const a = schema([table('users', [col('id', 'INT', { isPrimaryKey: true, nullable: false })])]);
    const b = schema([table('users', [col('id', 'INT', { isPrimaryKey: true, nullable: false })])]);
    expect(diffSchemas(a, b)).toEqual([]);
  });
});

describe('diffSchemas — 테이블 추가/삭제', () => {
  it('테이블 추가 → createTable', () => {
    const a = schema([]);
    const b = schema([table('users', [col('id')])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('createTable');
    // 빈 A 에 fold → B 동치
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });

  it('테이블 삭제 → dropTable', () => {
    const a = schema([table('users', [col('id')]), table('legacy', [col('x')])]);
    const b = schema([table('users', [col('id')])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('dropTable');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });
});

describe('diffSchemas — 테이블 이름 변경(id 기준)', () => {
  it('같은 id·다른 이름 → renameTable(add+drop 아님)', () => {
    const shared = tid('keep');
    const a = schema([table('old_name', [col('id')], shared)]);
    const b = schema([table('new_name', [col('id')], shared)]);
    const ops = diffSchemas(a, b);
    const types = ops.map((o) => o.type);
    expect(types).toContain('renameTable');
    expect(types).not.toContain('dropTable');
    expect(types).not.toContain('createTable');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });
});

describe('diffSchemas — 컬럼 추가/삭제/변경/이름변경', () => {
  it('컬럼 추가 → addColumn', () => {
    const a = schema([table('t', [col('id')])]);
    const b = schema([table('t', [col('id'), col('email', 'VARCHAR')])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('addColumn');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });

  it('컬럼 삭제 → dropColumn', () => {
    const a = schema([table('t', [col('id'), col('temp')])]);
    const b = schema([table('t', [col('id')])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('dropColumn');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });

  it('컬럼 타입 변경 → modifyColumnType', () => {
    const a = schema([table('t', [col('age', 'INT')])]);
    const b = schema([table('t', [col('age', 'BIGINT')])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('modifyColumnType');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });

  it('컬럼 이름 변경(id 기준) → renameColumn', () => {
    const shared = cid('rename-target');
    const a = schema([table('t', [{ ...col('a'), id: shared }])]);
    const b = schema([table('t', [{ ...col('b'), id: shared }])]);
    const ops = diffSchemas(a, b);
    const types = ops.map((o) => o.type);
    expect(types).toContain('renameColumn');
    expect(types).not.toContain('addColumn');
    expect(types).not.toContain('dropColumn');
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });
});

describe('diffSchemas — 관계(FK) 추가/삭제', () => {
  function rel(id: string, name: string, src: Table, srcCol: Column, tgt: Table, tgtCol: Column): Relationship {
    return {
      id,
      name,
      sourceTableId: src.id,
      targetTableId: tgt.id,
      type: '1:N',
      sourceColumnIds: [srcCol.id],
      targetColumnIds: [tgtCol.id],
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    };
  }

  it('관계 추가 → addForeignKey', () => {
    const uId = col('id', 'INT', { isPrimaryKey: true });
    const users = table('users', [uId]);
    const oFk = col('user_id', 'INT');
    const orders = table('orders', [col('id'), oFk]);
    const a = schema([users, orders]);
    const b = schema([users, orders], [rel('r1', 'fk_orders_user', users, uId, orders, oFk)]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('addForeignKey');
  });

  it('관계 삭제 → dropForeignKey', () => {
    const uId = col('id', 'INT', { isPrimaryKey: true });
    const users = table('users', [uId]);
    const oFk = col('user_id', 'INT');
    const orders = table('orders', [col('id'), oFk]);
    const r = rel('r1', 'fk_orders_user', users, uId, orders, oFk);
    const a = schema([users, orders], [r]);
    const b = schema([users, orders]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('dropForeignKey');
  });
});

describe('diffSchemas — 인덱스 추가/삭제', () => {
  it('인덱스 추가 → createIndex', () => {
    const c = col('email', 'VARCHAR');
    const a = schema([table('t', [c])]);
    const withIdx = table('t', [c]);
    withIdx.indexes = [{ id: 'idx1', name: 'idx_t_email', columnIds: [c.id], unique: true }];
    const b = schema([withIdx]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('createIndex');
  });

  it('인덱스 삭제 → dropIndex', () => {
    const c = col('email', 'VARCHAR');
    const withIdx = table('t', [c]);
    withIdx.indexes = [{ id: 'idx1', name: 'idx_t_email', columnIds: [c.id], unique: true }];
    const a = schema([withIdx]);
    const b = schema([table('t', [c])]);
    const ops = diffSchemas(a, b);
    expect(ops.map((o) => o.type)).toContain('dropIndex');
  });
});

// 관계의 source/target/컬럼을 이름 기반 정규형으로(id 무시 — 라운드트립 후 id 가 새로 발급됨).
// 규약: source = 참조/PK 테이블(users), target = FK 보유 테이블(orders).
function normalizeRels(s: ERDSchema) {
  const tname = (id: string) => s.tables[id]?.name ?? id;
  const cname = (tid: string, cid: string) =>
    s.tables[tid]?.columns.find((c) => c.id === cid)?.name ?? cid;
  return Object.values(s.relationships)
    .map((r) => ({
      name: r.name ?? null,
      source: tname(r.sourceTableId), // 참조/PK 테이블
      target: tname(r.targetTableId), // FK 보유 테이블
      sourceColumns: r.sourceColumnIds.map((cid) => cname(r.sourceTableId, cid)).sort(),
      targetColumns: r.targetColumnIds.map((cid) => cname(r.targetTableId, cid)).sort(),
      onDelete: r.onDelete,
      onUpdate: r.onUpdate,
    }))
    .sort((a, b) => `${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`));
}

describe('diffSchemas — FK .mig 라운드트립 반전 회귀(소켓 E2E 가 잡은 버그)', () => {
  // users(PK id) ← orders(users_id FK). autoFk 규약: source=users(PK), target=orders(FK보유).
  function fkSchema(): ERDSchema {
    const uId = col('id', 'INT', { isPrimaryKey: true, nullable: false });
    const users = table('users', [uId]);
    const oId = col('id', 'INT', { isPrimaryKey: true, nullable: false });
    const oFk = col('users_id', 'INT');
    const orders = table('orders', [oId, oFk]);
    const r: Relationship = {
      id: 'rel-1',
      name: 'fk_orders_users_id',
      sourceTableId: users.id, // 참조/PK
      targetTableId: orders.id, // FK 보유
      type: '1:N',
      sourceColumnIds: [uId.id],
      targetColumnIds: [oFk.id],
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    };
    return schema([users, orders], [r]);
  }

  it('diff(empty,working) → serializeMig → parseMig → fold from empty: 관계 source/target/컬럼 동치', () => {
    const working = fkSchema();
    const empty: ERDSchema = { tables: {}, relationships: {}, layers: {} };

    const ops = diffSchemas(empty, working);
    const mig = serializeMig(ops);

    // .mig 의 add fk 는 FK 보유 테이블(orders)에 걸려야 한다.
    expect(mig).toContain('add fk fk_orders_users_id on orders ( users_id ) -> users ( id )');

    const { ops: up } = parseMig(mig);
    let folded: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    for (const op of up) folded = applyOperation(folded, op);

    expect(normalizeRels(folded)).toEqual(normalizeRels(working));
  });

  it('라운드트립 baseline 으로 재diff 하면 spurious FK pending 이 없다(clean)', () => {
    const working = fkSchema();
    const empty: ERDSchema = { tables: {}, relationships: {}, layers: {} };

    // 1차: empty→working diff 를 .mig 로 직렬화/재파싱해 baseline 을 fold(소켓 시나리오의 init.mig).
    const ops1 = diffSchemas(empty, working);
    const mig = serializeMig(ops1);
    const { ops: up } = parseMig(mig);
    let baseline: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    for (const op of up) baseline = applyOperation(baseline, op);

    // 2차: baseline vs working 재diff → 관계 관련 op 가 없어야 한다(반전 시 add/drop fk spurious).
    const ops2 = diffSchemas(baseline, working);
    const fkOps = ops2.filter((o) => o.type === 'addForeignKey' || o.type === 'dropForeignKey');
    expect(fkOps).toEqual([]);
  });
});

describe('diffSchemas — 복합 시나리오 A→B fold 동치', () => {
  it('테이블 추가 + 컬럼 추가/삭제/변경 동시', () => {
    const a = schema([
      table('users', [
        col('id', 'INT', { isPrimaryKey: true, nullable: false }),
        col('legacy', 'TEXT'),
        col('age', 'INT'),
      ]),
    ]);
    const b = schema([
      table('users', [
        col('id', 'INT', { isPrimaryKey: true, nullable: false }),
        col('age', 'BIGINT'), // 타입 변경
        col('email', 'VARCHAR'), // 추가
        // legacy 삭제
      ]),
      table('posts', [col('id', 'INT', { isPrimaryKey: true, nullable: false })]), // 새 테이블
    ]);
    const ops = diffSchemas(a, b);
    expect(ops.length).toBeGreaterThan(0);
    expect(normalize(fold(a, ops))).toEqual(normalize(b));
  });
});
