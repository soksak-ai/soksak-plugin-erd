import { describe, it, expect } from 'vitest';
import type { ERDSchema, Table, Column } from '@/types/schema';
import type { DialectId } from './dialect/types';
import { buildPushPlan } from './push-plan';

// ── 픽스처 헬퍼 ──────────────────────────────────────────────────────────────
function col(id: string, name: string, over: Partial<Column> = {}): Column {
  return {
    id,
    name,
    dataType: 'TEXT',
    nullable: true,
    autoIncrement: false,
    isPrimaryKey: false,
    isUnique: false,
    ...over,
  };
}
function table(id: string, name: string, columns: Column[]): Table {
  return { id, name, columns, indexes: [] };
}
function schema(tables: Table[]): ERDSchema {
  return {
    tables: Object.fromEntries(tables.map((t) => [t.id, t])),
    relationships: {},
    layers: {},
  };
}
const EMPTY = schema([]);

describe('buildPushPlan — forward push (plan §4 db-push)', () => {
  it('테이블 추가: 라이브에 없던 테이블 → CREATE, 파괴성/개명 후보 없음', () => {
    const current = schema([
      table('t1', 'posts', [
        col('c1', 'id', { dataType: 'INTEGER', isPrimaryKey: true, autoIncrement: true, nullable: false }),
        col('c2', 'title', { dataType: 'VARCHAR', length: 255, nullable: false }),
      ]),
    ]);

    const plan = buildPushPlan(current, EMPTY, 'sqlite');

    expect(plan.ops.some((o) => o.type === 'createTable')).toBe(true);
    expect(plan.sql).toContain('CREATE TABLE');
    expect(plan.sql).toContain('"posts"');
    expect(plan.destructive).toHaveLength(0);
    expect(plan.renamesNeedingConfirm).toHaveLength(0);
  });

  it('컬럼 삭제: 모델에서 사라진 컬럼 → dropColumn 이 파괴성으로 표기', () => {
    const live = schema([
      table('t1', 'users', [
        col('c1', 'id', { dataType: 'INTEGER', isPrimaryKey: true, nullable: false }),
        col('c2', 'email', { dataType: 'VARCHAR', length: 255 }),
      ]),
    ]);
    const current = schema([
      table('t1', 'users', [col('c1', 'id', { dataType: 'INTEGER', isPrimaryKey: true, nullable: false })]),
    ]);

    const plan = buildPushPlan(current, live, 'sqlite');

    const drop = plan.ops.find((o) => o.type === 'dropColumn');
    expect(drop).toBeDefined();
    expect(drop!.params.name).toBe('email');

    const d = plan.destructive.find((x) => x.op.type === 'dropColumn' && x.op.params.name === 'email');
    expect(d).toBeDefined();
    expect(d!.reason).toContain('소실');
    // 삭제일 뿐 개명 후보 아님(대응 add 없음).
    expect(plan.renamesNeedingConfirm).toHaveLength(0);
  });

  it('3-dialect: 같은 모델이 sqlite/mysql/postgresql 로 각기 다른 DDL 을 생성', () => {
    const current = schema([
      table('t1', 'items', [
        col('c1', 'id', { dataType: 'INTEGER', isPrimaryKey: true, autoIncrement: true, nullable: false }),
        col('c2', 'name', { dataType: 'VARCHAR', length: 100, nullable: false }),
      ]),
    ]);

    const dialects: DialectId[] = ['sqlite', 'mysql', 'postgresql'];
    const sql = Object.fromEntries(
      dialects.map((d) => [d, buildPushPlan(current, EMPTY, d).sql]),
    ) as Record<DialectId, string>;

    for (const d of dialects) {
      expect(sql[d]).toContain('CREATE TABLE');
      expect(sql[d].length).toBeGreaterThan(0);
    }
    // 방언별 인용/키워드 비대칭.
    expect(sql.sqlite).toContain('"items"');
    expect(sql.sqlite).not.toContain('`');
    expect(sql.mysql).toContain('`items`');
    expect(sql.mysql).toContain('AUTO_INCREMENT');
    expect(sql.postgresql).toContain('"items"');
    expect(sql.postgresql).not.toContain('`');
    // 세 방언 산출물이 실제로 서로 다르다.
    expect(new Set([sql.sqlite, sql.mysql, sql.postgresql]).size).toBe(3);
  });

  it('개명 모호: 라이브 컬럼명≠모델 컬럼명(안정 id 없음) → renamesNeedingConfirm, 자동 미적용', () => {
    // 라이브 리버스는 새 id 를 만든다 → 같은 테이블이라도 컬럼 id 가 어긋난다.
    const live = schema([
      table('t1', 'users', [col('a1', 'username', { dataType: 'VARCHAR', length: 50 })]),
    ]);
    const current = schema([
      table('t1', 'users', [col('b1', 'handle', { dataType: 'VARCHAR', length: 50 })]),
    ]);

    const plan = buildPushPlan(current, live, 'sqlite');

    // ops 는 추측 없이 drop(username)+add(handle) 그대로.
    expect(plan.ops.some((o) => o.type === 'dropColumn' && o.params.name === 'username')).toBe(true);
    expect(plan.ops.some((o) => o.type === 'addColumn' && o.params.name === 'handle')).toBe(true);

    const cand = plan.renamesNeedingConfirm.find((r) => r.from === 'username' && r.to === 'handle');
    expect(cand).toBeDefined();
    expect(cand!.level).toBe('column');
    expect(cand!.table).toBe('users');

    // drop 은 여전히 파괴성 목록에도 남는다(개명 확정 전까지 데이터 손실 가능).
    expect(plan.destructive.some((x) => x.op.type === 'dropColumn' && x.op.params.name === 'username')).toBe(true);
  });

  it('타입 축소: BIGINT→INTEGER 는 파괴성, 위젯닝 INTEGER→BIGINT 는 안전', () => {
    const narrow = buildPushPlan(
      schema([table('t1', 't', [col('c1', 'n', { dataType: 'INTEGER' })])]),
      schema([table('t1', 't', [col('c1', 'n', { dataType: 'BIGINT' })])]),
      'mysql',
    );
    expect(
      narrow.destructive.some((x) => x.op.type === 'modifyColumnType' && /축소|이종/.test(x.reason)),
    ).toBe(true);

    const widen = buildPushPlan(
      schema([table('t1', 't', [col('c1', 'n', { dataType: 'BIGINT' })])]),
      schema([table('t1', 't', [col('c1', 'n', { dataType: 'INTEGER' })])]),
      'mysql',
    );
    expect(widen.destructive.some((x) => x.op.type === 'modifyColumnType')).toBe(false);
  });

  it('정의 재적재(drop+add 같은 이름): 개명 아닌 파괴성으로만 분류', () => {
    // 같은 id·같은 이름, nullable 만 변경 → diff.ts 가 dropColumn+addColumn 재적재를 낸다.
    const live = schema([table('t1', 't', [col('c1', 'age', { dataType: 'INTEGER', nullable: true })])]);
    const current = schema([table('t1', 't', [col('c1', 'age', { dataType: 'INTEGER', nullable: false })])]);

    const plan = buildPushPlan(current, live, 'sqlite');

    const d = plan.destructive.find((x) => x.op.type === 'dropColumn' && x.op.params.name === 'age');
    expect(d).toBeDefined();
    expect(d!.reason).toContain('재정의');
    // 같은 이름 재적재는 개명 후보가 아니다.
    expect(plan.renamesNeedingConfirm).toHaveLength(0);
  });
});
