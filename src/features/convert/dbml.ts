import type { ERDSchema, Table, Column, Relationship, RelationType } from '@/types/schema';
import { generateId } from '@/lib/id';
import { sqlToDbml, dbmlToSql } from './type-map';
import { registerConverter, type Converter, type ParseResult } from './registry';

// ── DBML generate ───────────────────────────────────────────────────────
// FK 방향 규약: source = 참조(PK) 측, target = FK 보유 측.
// DBML Ref 문법 "A.x > B.y" 는 A(=FK 보유=target) 가 B(=참조 PK=source) 를 가리킨다.

export function generateDbml(schema: ERDSchema): string {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return '// 정의된 테이블이 없습니다';

  const blocks: string[] = [];

  for (const table of tables) {
    const lines: string[] = [`Table ${table.name} {`];
    for (const col of table.columns) {
      lines.push('  ' + generateColumnLine(col));
    }
    lines.push('}');
    blocks.push(lines.join('\n'));
  }

  // 관계 → Ref 라인
  const refLines: string[] = [];
  for (const rel of Object.values(schema.relationships)) {
    const source = schema.tables[rel.sourceTableId]; // 참조(PK) 측
    const target = schema.tables[rel.targetTableId]; // FK 보유 측
    if (!source || !target) continue;
    const fkCol = target.columns.find((c) => c.id === rel.targetColumnIds[0])?.name;
    const refCol = source.columns.find((c) => c.id === rel.sourceColumnIds[0])?.name;
    if (!fkCol || !refCol) continue;
    const op = relationOperator(rel.type);
    refLines.push(`Ref: ${target.name}.${fkCol} ${op} ${source.name}.${refCol}`);
  }

  return blocks.join('\n\n') + (refLines.length > 0 ? '\n\n' + refLines.join('\n') : '') + '\n';
}

function generateColumnLine(col: Column): string {
  const type = sqlToDbml(col.dataType);
  // 길이가 있으면 varchar(255) 형태로 보존
  const typeWithLen = col.length && ['varchar', 'char'].includes(type) ? `${type}(${col.length})` : type;
  const settings: string[] = [];
  if (col.isPrimaryKey) settings.push('pk');
  if (col.autoIncrement) settings.push('increment');
  if (col.isUnique && !col.isPrimaryKey) settings.push('unique');
  if (!col.nullable && !col.isPrimaryKey) settings.push('not null');
  if (col.defaultValue !== undefined && col.defaultValue !== '') {
    settings.push(`default: ${formatDbmlDefault(col.defaultValue)}`);
  }
  const settingStr = settings.length > 0 ? ` [${settings.join(', ')}]` : '';
  return `${col.name} ${typeWithLen}${settingStr}`;
}

function formatDbmlDefault(value: string): string {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value; // 숫자
  if (/^(true|false)$/i.test(value)) return value.toLowerCase();
  if (/^`.*`$/.test(value)) return value; // 표현식 백틱
  return `'${value}'`;
}

function relationOperator(type: RelationType): string {
  switch (type) {
    case '1:1': return '-';
    case 'N:M': return '<>';
    case '1:N':
    default: return '>'; // many(FK 보유) → one(PK)
  }
}

// ── DBML parse ──────────────────────────────────────────────────────────
// Table 블록 + Ref 라인의 포커스드 파서.

export function parseDbml(input: string): ParseResult {
  const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };
  const warnings: string[] = [];

  // 주석 제거(// 와 -- 라인)
  const cleaned = input.replace(/\/\/[^\n]*/g, '').replace(/--[^\n]*/g, '');

  const tableIdByName = new Map<string, string>();

  // Table 블록 추출
  const tableRegex = /Table\s+("?[\w.]+"?)\s*(?:as\s+\w+\s*)?\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = tableRegex.exec(cleaned)) !== null) {
    const rawName = m[1].replace(/"/g, '');
    const tableName = rawName.includes('.') ? rawName.split('.').pop()! : rawName;
    const body = m[2];
    const tableId = generateId();
    const table: Table = { id: tableId, name: tableName, columns: [], indexes: [] };
    tableIdByName.set(tableName, tableId);

    const colLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^(indexes|Note)\b/i.test(l) && l !== '{' && l !== '}');

    for (const line of colLines) {
      // "name type[(len)] [settings]" — 인라인 ref 가 settings 에 있을 수 있음
      const colMatch = line.match(/^("?[\w]+"?)\s+([\w]+(?:\([^)]*\))?)\s*(\[[^\]]*\])?/);
      if (!colMatch) continue;
      const colName = colMatch[1].replace(/"/g, '');
      const rawType = colMatch[2];
      const settings = (colMatch[3] ?? '').toLowerCase();

      const lenMatch = rawType.match(/\((\d+)\)/);
      const col: Column = {
        id: generateId(),
        name: colName,
        dataType: dbmlToSql(rawType),
        nullable: !settings.includes('not null') && !settings.includes('pk'),
        autoIncrement: settings.includes('increment'),
        isPrimaryKey: settings.includes('pk') || settings.includes('primary key'),
        isUnique: settings.includes('unique'),
      };
      if (lenMatch) col.length = Number(lenMatch[1]);
      const defMatch = (colMatch[3] ?? '').match(/default:\s*('([^']*)'|`([^`]*)`|[^,\]]+)/i);
      if (defMatch) {
        col.defaultValue = (defMatch[2] ?? defMatch[3] ?? defMatch[1]).trim();
      }
      table.columns.push(col);
    }

    schema.tables[tableId] = table;
  }

  // Ref 라인 추출 — "Ref [name]: A.x <op> B.y" 또는 인라인 미지원 경고
  // op: > (many→one), < (one→many), - (one-to-one), <> (many-to-many)
  const refRegex = /Ref\s*(?:\w+\s*)?:\s*("?[\w]+"?)\.("?[\w]+"?)\s*(<>|<|>|-)\s*("?[\w]+"?)\.("?[\w]+"?)/g;
  let r: RegExpExecArray | null;
  while ((r = refRegex.exec(cleaned)) !== null) {
    const leftTable = r[1].replace(/"/g, '');
    const leftCol = r[2].replace(/"/g, '');
    const op = r[3];
    const rightTable = r[4].replace(/"/g, '');
    const rightCol = r[5].replace(/"/g, '');

    // 방향 결정: A.x > B.y → A=FK 보유(target), B=참조 PK(source)
    //            A.x < B.y → B=FK 보유(target), A=참조 PK(source)
    let fkTableName: string, fkColName: string, refTableName: string, refColName: string;
    let type: RelationType = '1:N';
    if (op === '<') {
      fkTableName = rightTable; fkColName = rightCol;
      refTableName = leftTable; refColName = leftCol;
    } else if (op === '<>') {
      type = 'N:M';
      fkTableName = leftTable; fkColName = leftCol;
      refTableName = rightTable; refColName = rightCol;
    } else if (op === '-') {
      type = '1:1';
      fkTableName = leftTable; fkColName = leftCol;
      refTableName = rightTable; refColName = rightCol;
    } else {
      // '>' (기본)
      fkTableName = leftTable; fkColName = leftCol;
      refTableName = rightTable; refColName = rightCol;
    }

    const fkTableId = tableIdByName.get(fkTableName);
    const refTableId = tableIdByName.get(refTableName);
    if (!fkTableId || !refTableId) {
      warnings.push(`Ref 해석 실패: ${leftTable}.${leftCol} ${op} ${rightTable}.${rightCol}`);
      continue;
    }
    const fkTable = schema.tables[fkTableId];
    const refTable = schema.tables[refTableId];
    const targetColId = fkTable.columns.find((c) => c.name === fkColName)?.id;
    const sourceColId = refTable.columns.find((c) => c.name === refColName)?.id;

    const relId = generateId();
    const rel: Relationship = {
      id: relId,
      sourceTableId: refTableId, // 참조(PK) 측
      targetTableId: fkTableId, // FK 보유 측
      type,
      sourceColumnIds: sourceColId ? [sourceColId] : [],
      targetColumnIds: targetColId ? [targetColId] : [],
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    };
    schema.relationships[relId] = rel;
  }

  return { schema, warnings };
}

// ── Converter 등록 ───────────────────────────────────────────────────────
export const dbmlConverter: Converter = {
  id: 'dbml',
  direction: 'both',
  parse: parseDbml,
  generate: generateDbml,
};

// 모듈 로드 시 자기 등록(단일 진실 레지스트리에 배선).
registerConverter(dbmlConverter);
