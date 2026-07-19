// Create a relationship between two tables — the single source shared by the
// REL MODE two-click flow and the Alt-drag connect gesture. Picks the source PK,
// finds or auto-creates the FK column on the target (with the <table>_<pk> name),
// and adds the directional relationship. Returns a typed result; never throws.
import type { Table } from '@/types/schema';

// 관계 모드 문자열('1:N'|'1:1'|'1|N'|'1|1') → 정규 타입/선호 라인스타일.
export type RelModeLabel = '1:N' | '1:1' | '1|N' | '1|1';

export interface RelStore {
  tables: Record<string, Table>;
  relationships: Record<string, unknown>;
  addColumn: (tableId: string, column?: Partial<Table['columns'][number]>) => void;
  addRelationship: (rel: {
    name: string;
    sourceTableId: string;
    targetTableId: string;
    sourceColumnIds: string[];
    targetColumnIds: string[];
    type: '1:1' | '1:N';
    lineStyle: 'dashed' | 'solid';
    onDelete: string;
    onUpdate: string;
  }) => string;
}

export interface CreateRelResult {
  ok: boolean;
  relId?: string;
  code?: 'SAME_TABLE' | 'MISSING_TABLE' | 'NO_SOURCE_COLUMN';
  message?: string;
}

// 소스 PK(없으면 첫 컬럼)와, 대상에서 <table>_<pk> 관례명에 맞는 FK 컬럼을 찾는다.
export function pickRelationshipColumns(
  sourceTable: { name: string; columns: Array<{ id: string; name: string; isPrimaryKey: boolean }> },
  targetTable: { columns: Array<{ id: string; name: string }> },
): { sourceColumnIds: string[]; targetColumnIds: string[] } {
  const sourcePks = sourceTable.columns.filter((c) => c.isPrimaryKey);
  const source = sourcePks[0] ?? sourceTable.columns[0];
  if (!source) return { sourceColumnIds: [], targetColumnIds: [] };

  const srcName = source.name.toLowerCase();
  const tableBase = sourceTable.name.toLowerCase();
  const candidates = new Set([
    `${tableBase}_${srcName}`,
    `${tableBase}_id`,
    `${tableBase}_seq`,
    `${tableBase.replace(/s$/, '')}_id`,
    `${tableBase.replace(/s$/, '')}_seq`,
  ]);
  const target = targetTable.columns.find((c) => candidates.has(c.name.toLowerCase())) ?? null;
  if (!target) return { sourceColumnIds: [source.id], targetColumnIds: [] };
  return { sourceColumnIds: [source.id], targetColumnIds: [target.id] };
}

export function createRelationship(
  // getState 접근자 — addColumn 이 store 를 갱신한 뒤 최신 tables 를 다시 읽어야 하므로 스냅샷이
  // 아닌 접근자를 받는다(immer 는 매 set 마다 새 상태 객체를 만든다).
  store: { getState(): RelStore },
  sourceTableId: string,
  targetTableId: string,
  mode: RelModeLabel,
): CreateRelResult {
  if (sourceTableId === targetTableId) {
    return { ok: false, code: 'SAME_TABLE', message: '같은 테이블끼리는 만들 수 없습니다' };
  }
  const sourceTable = store.getState().tables[sourceTableId];
  let targetTable = store.getState().tables[targetTableId];
  if (!sourceTable || !targetTable) {
    return { ok: false, code: 'MISSING_TABLE', message: '테이블을 찾을 수 없습니다' };
  }

  const picked = pickRelationshipColumns(sourceTable, targetTable);
  const sourceColumnIds = picked.sourceColumnIds;
  let targetColumnIds = picked.targetColumnIds;
  if (sourceColumnIds.length === 0) {
    return { ok: false, code: 'NO_SOURCE_COLUMN', message: `${sourceTable.name} 에 참조할 컬럼이 없습니다` };
  }

  // FK 컬럼이 없으면 <table>_<pk> 이름으로 자동 생성한다.
  if (targetColumnIds.length === 0) {
    const sourcePk = sourceTable.columns.find((c) => c.id === sourceColumnIds[0]) ?? sourceTable.columns[0];
    const fkName = `${sourceTable.name}_${sourcePk.name}`;
    const existing = targetTable.columns.find((c) => c.name.toLowerCase() === fkName.toLowerCase());
    if (existing) {
      targetColumnIds = [existing.id];
    } else {
      const beforeIds = new Set(targetTable.columns.map((c) => c.id));
      store.getState().addColumn(targetTableId, {
        name: fkName,
        dataType: sourcePk.dataType,
        nullable: true,
        autoIncrement: false,
        isPrimaryKey: false,
        isUnique: false,
      });
      targetTable = store.getState().tables[targetTableId];
      const created =
        targetTable?.columns.find((c) => !beforeIds.has(c.id) && c.name === fkName) ??
        targetTable?.columns.find((c) => c.name === fkName);
      if (!created) return { ok: false, code: 'NO_SOURCE_COLUMN', message: 'FK 컬럼 생성 실패' };
      targetColumnIds = [created.id];
    }
  }

  const type: '1:1' | '1:N' = mode.includes('N') ? '1:N' : '1:1';
  const lineStyle: 'dashed' | 'solid' = mode.includes('|') ? 'solid' : 'dashed';
  const relId = store.getState().addRelationship({
    name: `${sourceTable.name}_${targetTable.name}_fk`,
    sourceTableId,
    targetTableId,
    sourceColumnIds,
    targetColumnIds,
    type,
    lineStyle,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  });
  return { ok: true, relId };
}
