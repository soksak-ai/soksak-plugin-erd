import type { ERDSchema, Column, Table, Relationship } from '@/types/schema';
import { parseCreateTables } from '@/features/sql/sql-parser';
import type { Dialect, DialectCaps, CanonicalType, SchemaDiff } from './types';
import { attachUniqueConstraints } from './alter-fk';
import { deriveCanonical, sqliteAffinity } from './canonical';
import { quote, isReservedIn, generateAlterFor, normalizeQuotesForParser } from './shared';

const CAPS: DialectCaps = {
  identifierQuote: '"',
  schemas: false,
  autoIncrement: 'autoincrement', // INTEGER PRIMARY KEY AUTOINCREMENT
  enumStyle: 'check', // native ENUM 없음 → CHECK(또는 폴백 TEXT)
  inlineForeignKeys: true, // ALTER ADD FK 불가 → 본문 인라인만
  alterAddConstraint: false,
  partialIndexes: true,
  expressionIndexes: true,
  checkConstraints: true,
  engineCharset: false,
  sequences: false,
  identifierMaxLen: 0, // 사실상 제한 없음
};

// canonical base → SQLite 선언 타입(affinity 기반)
function mapCanonical(canon: CanonicalType, _col: Column): string {
  const base = canon.base;
  switch (base) {
    case 'BOOLEAN':
      return 'INTEGER'; // SQLite 는 0/1
    case 'SMALLINT':
    case 'INTEGER':
    case 'BIGINT':
      return 'INTEGER';
    case 'FLOAT':
    case 'DOUBLE':
      return 'REAL';
    case 'DECIMAL':
      return 'NUMERIC';
    case 'CHAR':
    case 'VARCHAR':
    case 'TEXT':
    case 'UUID':
    case 'ENUM': // 폴백: TEXT affinity
    case 'JSON':
      return 'TEXT';
    case 'BLOB':
      return 'BLOB';
    case 'DATE':
    case 'TIME':
    case 'TIMESTAMP':
    case 'DATETIME':
      return 'TEXT'; // SQLite 권장: ISO8601 텍스트
    default:
      return sqliteAffinity(base);
  }
}

const RESERVED = new Set([
  'ABORT',
  'ADD',
  'ALTER',
  'AND',
  'AS',
  'AUTOINCREMENT',
  'CONSTRAINT',
  'CREATE',
  'DEFAULT',
  'DELETE',
  'DROP',
  'FOREIGN',
  'FROM',
  'GROUP',
  'INDEX',
  'KEY',
  'ORDER',
  'PRIMARY',
  'REFERENCES',
  'SELECT',
  'TABLE',
  'UNIQUE',
  'UPDATE',
  'WHERE',
]);

// ── 파싱 ─────────────────────────────────────────────────────────────────
// 기존 parseCreateTables 를 재사용(인라인/테이블레벨 FK 처리). 단 SQLite 전용
// `INTEGER PRIMARY KEY AUTOINCREMENT` 는 base parser 가 autoIncrement 로 인식
// 못 하므로 원문을 보고 보정한다(단일 진실 미수정, 결과만 패치).
function parseSqlite(ddl: string): { schema: ERDSchema; warnings: string[] } {
  // double-quote 식별자 → backtick 정규화 후 위임(base parser 호환).
  const schema = parseCreateTables(normalizeQuotesForParser(ddl));
  attachUniqueConstraints(schema, ddl); // 테이블레벨 단일컬럼 UNIQUE 회복

  // AUTOINCREMENT 보정: 원문에서 컬럼별로 탐지(base parser 는 AUTO_INCREMENT/SERIAL 만 인식)
  for (const table of Object.values(schema.tables)) {
    for (const col of table.columns) {
      // "colname" ... AUTOINCREMENT 가 같은 컬럼 선언에 등장하는지 본문 스캔
      const re = new RegExp(
        `["\`]?${escapeRe(col.name)}["\`]?[^,(]*?\\bAUTOINCREMENT\\b`,
        'i',
      );
      if (re.test(ddl)) {
        col.autoIncrement = true;
        col.isPrimaryKey = true; // SQLite 에서 AUTOINCREMENT 는 INTEGER PRIMARY KEY 전제
      }
    }
  }

  return { schema, warnings: [] };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 생성 ─────────────────────────────────────────────────────────────────
// SQLite 는 FK 를 인라인으로만 표현(ALTER ADD FK 불가). 단일 INTEGER PK +
// AUTOINCREMENT 는 컬럼 인라인 제약으로 출력.
function generateSqlite(schema: ERDSchema): string {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return '-- No tables defined yet';

  const rels = Object.values(schema.relationships);
  const sorted = topoSort(tables, rels);
  const q = (n: string) => quote(n, '"');

  const blocks: string[] = [];
  for (const table of sorted) {
    blocks.push(generateCreate(table, schema, q));
  }
  return blocks.join('\n\n');
}

function generateCreate(
  table: Table,
  schema: ERDSchema,
  q: (n: string) => string,
): string {
  const lines: string[] = [];
  const pkCols = table.columns.filter((c) => c.isPrimaryKey);
  const singleIntPk =
    pkCols.length === 1 && pkCols[0].autoIncrement;

  for (const col of table.columns) {
    const canon = deriveCanonical(col);
    const type = mapCanonical(canon, col);
    let def = `  ${q(col.name)} ${type}`;

    if (singleIntPk && col.isPrimaryKey && col.autoIncrement) {
      // SQLite 전용 인라인: INTEGER PRIMARY KEY AUTOINCREMENT
      def = `  ${q(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
    } else {
      if (!col.nullable) def += ' NOT NULL';
      if (col.isUnique && !col.isPrimaryKey) def += ' UNIQUE';
      if (col.defaultValue !== undefined && col.defaultValue !== '') {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }
    lines.push(def);
  }

  // 복합/비-autoincrement PK 는 테이블레벨 제약
  if (!singleIntPk && pkCols.length > 0) {
    lines.push(`  PRIMARY KEY (${pkCols.map((c) => q(c.name)).join(', ')})`);
  }

  // 인라인 FK — 이 테이블이 target(FK 보유)인 관계만
  for (const rel of Object.values(schema.relationships)) {
    if (rel.targetTableId !== table.id) continue;
    const refTable = schema.tables[rel.sourceTableId];
    if (!refTable) continue;
    const cols = rel.targetColumnIds
      .map((id) => table.columns.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
    const refCols = rel.sourceColumnIds
      .map((id) => refTable.columns.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
    if (cols.length === 0 || refCols.length === 0) continue;

    let fk =
      `  CONSTRAINT ${q(rel.name ?? `fk_${table.name}_${refTable.name}`)} ` +
      `FOREIGN KEY (${cols.map(q).join(', ')}) ` +
      `REFERENCES ${q(refTable.name)} (${refCols.map(q).join(', ')})`;
    if (rel.onDelete && rel.onDelete !== 'NO ACTION') fk += ` ON DELETE ${rel.onDelete}`;
    if (rel.onUpdate && rel.onUpdate !== 'NO ACTION') fk += ` ON UPDATE ${rel.onUpdate}`;
    lines.push(fk);
  }

  return `CREATE TABLE ${q(table.name)} (\n${lines.join(',\n')}\n);`;
}

// FK 위상정렬(참조 테이블 먼저). ddl-generator 의 알고리즘과 동치.
function topoSort(tables: Table[], rels: Relationship[]): Table[] {
  const map = new Map(tables.map((t) => [t.id, t]));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tables) {
    indeg.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const r of rels) {
    if (map.has(r.sourceTableId) && map.has(r.targetTableId)) {
      adj.get(r.sourceTableId)!.push(r.targetTableId);
      indeg.set(r.targetTableId, (indeg.get(r.targetTableId) ?? 0) + 1);
    }
  }
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const result: Table[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const t = map.get(cur);
    if (t) result.push(t);
    for (const nb of adj.get(cur) ?? []) {
      const d = (indeg.get(nb) ?? 1) - 1;
      indeg.set(nb, d);
      if (d === 0) queue.push(nb);
    }
  }
  for (const t of tables) if (!result.find((r) => r.id === t.id)) result.push(t);
  return result;
}

export const sqliteDialect: Dialect = {
  id: 'sqlite',
  displayName: 'SQLite',
  caps: CAPS,

  parse: parseSqlite,
  generate: generateSqlite,

  generateAlter(diff: SchemaDiff): string {
    return generateAlterFor(diff, CAPS, (n) => quote(n, CAPS.identifierQuote));
  },

  quoteIdent(name: string): string {
    return quote(name, CAPS.identifierQuote);
  },

  isReserved(word: string): boolean {
    return isReservedIn(word, RESERVED);
  },

  mapType(canonical: CanonicalType, col: Column): string {
    return mapCanonical(canonical, col);
  },

  parseType(native: string): CanonicalType {
    return deriveCanonical({ dataType: native } as Column);
  },
};
