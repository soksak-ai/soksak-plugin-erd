// 스키마 diff → Operation[] (순수함수, 헤드리스).
// 두 ERDSchema(before/after)의 차이를 기존 OperationType 으로 산출한다.
// 산출된 ops 는 applyOperation 으로 fold 가능하고 serializeMig 로 .mig 텍스트가 된다.
//
// ── 매칭 규약 ────────────────────────────────────────────────────────────────
// - 테이블/컬럼: id 우선(같은 id·다른 이름 → rename), id 매칭 실패 시 이름 기준 add/drop.
//   id 채널은 store 스냅샷처럼 안정 id 가 보존될 때만 rename 을 잡는다(없으면 add+drop).
// - 관계(FK)/인덱스: 이름 기준 추가/삭제(속성 변경은 drop+add 로 표현 — ALTER 전체정의 규약).
// - 컬럼 정의 변경: dataType 변경은 modifyColumnType. nullable/default 변경은 drop+add 로
//   전체정의 재적재(현 mig 엔진의 alter 가능 표면에 맞춤 — 무손실 fold 우선).

import type { ERDSchema, Table, Column, Relationship } from '@/types/schema';
import type { Operation, OperationType } from './types';
import { generateId } from '@/lib/id';

// Operation 생성기(diff 산출용 — timestamp 0 고정으로 결정적).
function mkOp(type: OperationType, params: Record<string, unknown>): Operation {
  return { id: generateId(), type, timestamp: 0, params };
}

// 컬럼 → createTable/addColumn 의 정규 컬럼 표현(직렬화·적용 양쪽이 읽는 키).
function columnParams(c: Column): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: c.name,
    dataType: c.dataType,
    nullable: c.nullable,
    isPrimaryKey: c.isPrimaryKey,
    isUnique: c.isUnique,
    autoIncrement: c.autoIncrement,
  };
  if (c.defaultValue != null) out.defaultValue = c.defaultValue;
  if (c.length != null) out.length = c.length;
  if (c.precision != null) out.precision = c.precision;
  if (c.scale != null) out.scale = c.scale;
  return out;
}

// 컬럼 정의 동치(이름 제외 속성 — rename 과 alter 를 구분하기 위함).
// store 컬럼은 일부 불리언 플래그가 미설정(undefined)일 수 있고, applyOperation 으로
// 재구성한 컬럼은 false 로 채워진다 → 기본값 정규화(?? )로 동치 판정해 위양성을 막는다.
function columnDefEqual(a: Column, b: Column): boolean {
  return (
    a.dataType === b.dataType &&
    (a.nullable ?? true) === (b.nullable ?? true) &&
    (a.isPrimaryKey ?? false) === (b.isPrimaryKey ?? false) &&
    (a.isUnique ?? false) === (b.isUnique ?? false) &&
    (a.autoIncrement ?? false) === (b.autoIncrement ?? false) &&
    (a.defaultValue ?? null) === (b.defaultValue ?? null)
  );
}

// 한 테이블 내부의 컬럼 diff → ops. 테이블 이름(after 기준)으로 주소지정.
function diffColumns(tableName: string, before: Table, after: Table): Operation[] {
  const ops: Operation[] = [];

  const afterById = new Map(after.columns.map((c) => [c.id, c]));
  const beforeByName = new Map(before.columns.map((c) => [c.name, c]));
  const afterByName = new Map(after.columns.map((c) => [c.name, c]));

  // id 로 매칭된 쌍은 rename/alter 처리, 매칭 실패분은 이름 기준 add/drop.
  const matchedBeforeIds = new Set<string>();
  const matchedAfterIds = new Set<string>();

  // 1) id 기준 매칭(같은 컬럼의 진화 — rename/타입변경 추적).
  for (const bc of before.columns) {
    const ac = afterById.get(bc.id);
    if (!ac) continue;
    matchedBeforeIds.add(bc.id);
    matchedAfterIds.add(ac.id);

    // 이름 변경.
    if (bc.name !== ac.name) {
      ops.push(mkOp('renameColumn', { table: tableName, oldName: bc.name, newName: ac.name }));
    }
    // 타입 변경(이름 변경 후 새 이름으로 주소지정).
    if (bc.dataType !== ac.dataType) {
      ops.push(mkOp('modifyColumnType', { table: tableName, column: ac.name, oldType: bc.dataType, newType: ac.dataType }));
    }
    // 그 외 정의 변경(nullable/default/pk/unique/ai)은 drop+add 로 전체정의 재적재.
    const nameAligned: Column = { ...bc, name: ac.name };
    if (!columnDefEqual(nameAligned, ac)) {
      ops.push(mkOp('dropColumn', { table: tableName, name: ac.name }));
      ops.push(mkOp('addColumn', { table: tableName, ...columnParams(ac) }));
    }
  }

  // 2) id 매칭 실패분 — 이름 기준으로 add/drop(안정 id 없는 스키마 경로).
  for (const ac of after.columns) {
    if (matchedAfterIds.has(ac.id)) continue;
    if (beforeByName.has(ac.name)) {
      // 같은 이름이 before 에도 있으나 id 가 다름 → 정의 비교로 alter 결정.
      const bc = beforeByName.get(ac.name)!;
      if (bc.dataType !== ac.dataType) {
        ops.push(mkOp('modifyColumnType', { table: tableName, column: ac.name, oldType: bc.dataType, newType: ac.dataType }));
      }
      if (!columnDefEqual(bc, ac)) {
        ops.push(mkOp('dropColumn', { table: tableName, name: ac.name }));
        ops.push(mkOp('addColumn', { table: tableName, ...columnParams(ac) }));
      }
      matchedBeforeIds.add(bc.id);
    } else {
      ops.push(mkOp('addColumn', { table: tableName, ...columnParams(ac) }));
    }
  }
  for (const bc of before.columns) {
    if (matchedBeforeIds.has(bc.id)) continue;
    if (!afterByName.has(bc.name)) {
      ops.push(mkOp('dropColumn', { table: tableName, name: bc.name }));
    }
  }

  return ops;
}

// 인덱스 diff(이름 기준 add/drop). columnIds → 컬럼 이름으로 변환(엔진은 이름을 받는다).
function diffIndexes(tableName: string, before: Table, after: Table): Operation[] {
  const ops: Operation[] = [];
  const colName = (t: Table, id: string) => t.columns.find((c) => c.id === id)?.name;

  const beforeNames = new Set(before.indexes.map((i) => i.name));
  const afterNames = new Set(after.indexes.map((i) => i.name));

  for (const idx of after.indexes) {
    if (beforeNames.has(idx.name)) continue;
    const columns = idx.columnIds.map((id) => colName(after, id)).filter((n): n is string => n != null);
    if (columns.length === 0) continue;
    ops.push(mkOp('createIndex', { table: tableName, name: idx.name, columns, unique: idx.unique }));
  }
  for (const idx of before.indexes) {
    if (afterNames.has(idx.name)) continue;
    ops.push(mkOp('dropIndex', { table: tableName, name: idx.name }));
  }

  return ops;
}

// 관계(FK) → addForeignKey 파라미터. table=FK 보유(target), refTable=참조(source).
// columns/refColumns 는 이름(엔진 규약). 이름 못 찾으면 빈 배열 → 호출측에서 스킵.
function relToFkParams(rel: Relationship, after: ERDSchema): Record<string, unknown> | null {
  const target = after.tables[rel.targetTableId]; // FK 보유
  const source = after.tables[rel.sourceTableId]; // 참조 대상
  if (!target || !source) return null;
  const columns = rel.targetColumnIds
    .map((id) => target.columns.find((c) => c.id === id)?.name)
    .filter((n): n is string => n != null);
  const refColumns = rel.sourceColumnIds
    .map((id) => source.columns.find((c) => c.id === id)?.name)
    .filter((n): n is string => n != null);
  if (columns.length === 0 || refColumns.length === 0) return null;
  const name = rel.name ?? `fk_${target.name}_${columns[0]}`;
  return {
    name,
    table: target.name,
    columns,
    refTable: source.name,
    refColumns,
    onDelete: rel.onDelete,
    onUpdate: rel.onUpdate,
  };
}

// 관계 식별 키 — 구조 기반(이름 무관).
// FK 이름은 라운드트립에서 자동생성/누락이 갈려(working=undefined vs .mig 베이스라인=fk_…)
// 같은 관계를 다르게 보면 spurious add/drop 이 난다 → source/target 테이블 + 컬럼 이름으로
// 동일성을 판정한다(이름은 식별 키에서 제외).
function relKey(rel: Relationship, schema: ERDSchema): string {
  const s = schema.tables[rel.sourceTableId];
  const t = schema.tables[rel.targetTableId];
  const sName = s?.name ?? rel.sourceTableId;
  const tName = t?.name ?? rel.targetTableId;
  const sCols = rel.sourceColumnIds
    .map((id) => s?.columns.find((c) => c.id === id)?.name ?? id)
    .sort()
    .join(',');
  const tCols = rel.targetColumnIds
    .map((id) => t?.columns.find((c) => c.id === id)?.name ?? id)
    .sort()
    .join(',');
  return `${sName}(${sCols})->${tName}(${tCols})`;
}

function diffRelationships(before: ERDSchema, after: ERDSchema): Operation[] {
  const ops: Operation[] = [];
  const beforeKeys = new Set(Object.values(before.relationships).map((r) => relKey(r, before)));
  const afterKeys = new Set(Object.values(after.relationships).map((r) => relKey(r, after)));

  // 추가.
  for (const rel of Object.values(after.relationships)) {
    if (beforeKeys.has(relKey(rel, after))) continue;
    const params = relToFkParams(rel, after);
    if (params) ops.push(mkOp('addForeignKey', params));
  }
  // 삭제.
  for (const rel of Object.values(before.relationships)) {
    if (afterKeys.has(relKey(rel, before))) continue;
    const target = before.tables[rel.targetTableId];
    if (!target) continue;
    const columns = rel.targetColumnIds
      .map((id) => target.columns.find((c) => c.id === id)?.name)
      .filter((n): n is string => n != null);
    const name = rel.name ?? `fk_${target.name}_${columns[0] ?? 'x'}`;
    ops.push(mkOp('dropForeignKey', { table: target.name, name }));
  }

  return ops;
}

/**
 * 두 ERDSchema 의 차이를 Operation[] 으로 산출한다(순수함수).
 *
 * 산출 순서: 테이블 생성/이름변경 → 컬럼/인덱스 변경 → 테이블 삭제 → 관계 추가/삭제.
 * (생성을 먼저, 삭제를 나중에 두어 fold 시 참조 깨짐을 줄인다.)
 *
 * @param before 변경 전 스키마
 * @param after  변경 후 스키마
 * @returns applyOperation 으로 before 에 fold 하면 after 와 동치가 되는 ops
 */
export function diffSchemas(before: ERDSchema, after: ERDSchema): Operation[] {
  const created: Operation[] = [];
  const altered: Operation[] = [];
  const dropped: Operation[] = [];

  const beforeTables = Object.values(before.tables);
  const afterTables = Object.values(after.tables);

  const afterById = new Map(afterTables.map((t) => [t.id, t]));
  const beforeByName = new Map(beforeTables.map((t) => [t.name, t]));
  const afterByName = new Map(afterTables.map((t) => [t.name, t]));

  const matchedBeforeIds = new Set<string>();
  const matchedAfterIds = new Set<string>();

  // 1) id 기준 매칭(rename + 내부 diff).
  for (const bt of beforeTables) {
    const at = afterById.get(bt.id);
    if (!at) continue;
    matchedBeforeIds.add(bt.id);
    matchedAfterIds.add(at.id);

    if (bt.name !== at.name) {
      altered.push(mkOp('renameTable', { oldName: bt.name, newName: at.name }));
    }
    altered.push(...diffColumns(at.name, bt, at));
    altered.push(...diffIndexes(at.name, bt, at));
  }

  // 2) id 매칭 실패분 — 이름 기준.
  for (const at of afterTables) {
    if (matchedAfterIds.has(at.id)) continue;
    const bt = beforeByName.get(at.name);
    if (bt && !matchedBeforeIds.has(bt.id)) {
      // 같은 이름·다른 id → 동일 테이블로 간주하고 내부 diff.
      matchedBeforeIds.add(bt.id);
      altered.push(...diffColumns(at.name, bt, at));
      altered.push(...diffIndexes(at.name, bt, at));
    } else {
      // 새 테이블.
      created.push(mkOp('createTable', { name: at.name, columns: at.columns.map(columnParams), ...(at.schema ? { schema: at.schema } : {}) }));
      // 새 테이블의 인덱스도 생성.
      altered.push(...diffIndexes(at.name, { ...at, indexes: [] }, at));
    }
  }
  for (const bt of beforeTables) {
    if (matchedBeforeIds.has(bt.id)) continue;
    if (!afterByName.has(bt.name)) {
      dropped.push(mkOp('dropTable', { name: bt.name }));
    }
  }

  // 3) 관계(FK)는 테이블/컬럼 확정 후.
  const rels = diffRelationships(before, after);

  return [...created, ...altered, ...dropped, ...rels];
}
