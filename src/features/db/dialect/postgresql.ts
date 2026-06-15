import type { ERDSchema, Column } from '@/types/schema';
import { parseCreateTables } from '@/features/sql/sql-parser';
import { generateDDL } from '@/features/sql/ddl-generator';
import type { Dialect, DialectCaps, CanonicalType, SchemaDiff } from './types';
import { deriveCanonical, renderTypeWithArgs } from './canonical';
import { attachAlterForeignKeys, attachUniqueConstraints } from './alter-fk';
import { quote, isReservedIn, generateAlterFor, normalizeQuotesForParser } from './shared';

const CAPS: DialectCaps = {
  identifierQuote: '"',
  schemas: true,
  autoIncrement: 'serial', // SERIAL/BIGSERIAL (ddl-generator 가 실현)
  enumStyle: 'check', // 인라인 native ENUM 미지원 → CHECK/별도 타입; 본 엔진은 VARCHAR 폴백
  inlineForeignKeys: false,
  alterAddConstraint: true,
  partialIndexes: true,
  expressionIndexes: true,
  checkConstraints: true,
  engineCharset: false,
  sequences: true,
  identifierMaxLen: 63,
};

function mapCanonical(canon: CanonicalType, _col: Column): string {
  const base = canon.base;
  switch (base) {
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'INTEGER':
      return 'INTEGER';
    case 'SMALLINT':
      return 'SMALLINT';
    case 'BIGINT':
      return 'BIGINT';
    case 'FLOAT':
      return 'REAL';
    case 'DOUBLE':
      return 'DOUBLE PRECISION';
    case 'DECIMAL':
      return renderTypeWithArgs('NUMERIC', canon.args);
    case 'VARCHAR':
      return renderTypeWithArgs('VARCHAR', canon.args ?? [255]);
    case 'CHAR':
      return renderTypeWithArgs('CHAR', canon.args);
    case 'TEXT':
      return 'TEXT';
    case 'BLOB':
      return 'BYTEA';
    case 'JSON':
      return 'JSONB';
    case 'UUID':
      return 'UUID';
    case 'DATETIME':
      return 'TIMESTAMP';
    case 'TIMESTAMP':
      return 'TIMESTAMP';
    case 'DATE':
      return 'DATE';
    case 'TIME':
      return 'TIME';
    case 'ENUM':
      // PG 인라인 native ENUM 미사용 — VARCHAR 폴백(ddl-generator 와 동일 전략)
      return 'VARCHAR(255)';
    default:
      return canon.raw ?? renderTypeWithArgs(base, canon.args);
  }
}

const RESERVED = new Set([
  'ALL',
  'ANALYSE',
  'ANALYZE',
  'AND',
  'ANY',
  'AS',
  'ASC',
  'CONSTRAINT',
  'CREATE',
  'DEFAULT',
  'DESC',
  'DISTINCT',
  'DO',
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
  'USER',
  'WHERE',
]);

export const postgresqlDialect: Dialect = {
  id: 'postgresql',
  displayName: 'PostgreSQL',
  caps: CAPS,

  parse(ddl: string): { schema: ERDSchema; warnings: string[] } {
    // 식별자 double-quote 를 backtick 으로 정규화 후 위임(base parser 호환).
    const schema = parseCreateTables(normalizeQuotesForParser(ddl));
    // 회복 패스는 원문 기준(정규/역따옴표 모두 매칭).
    attachUniqueConstraints(schema, ddl);
    attachAlterForeignKeys(schema, ddl);
    // SERIAL 계열 회복: base parser 는 SERIAL 이 타입 위치에 오면 autoIncrement 로 인식
    // 못 한다. SERIAL=INTEGER+시퀀스 default 설탕이므로 정수 base + autoIncrement 로 환원.
    for (const table of Object.values(schema.tables)) {
      for (const col of table.columns) {
        const dt = col.dataType.toUpperCase();
        if (dt === 'SERIAL') {
          col.dataType = 'INTEGER';
          col.autoIncrement = true;
        } else if (dt === 'BIGSERIAL') {
          col.dataType = 'BIGINT';
          col.autoIncrement = true;
        } else if (dt === 'SMALLSERIAL') {
          col.dataType = 'SMALLINT';
          col.autoIncrement = true;
        }
      }
    }
    return { schema, warnings: [] };
  },

  generate(schema: ERDSchema): string {
    return generateDDL(schema, 'postgresql');
  },

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
