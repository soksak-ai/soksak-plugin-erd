import type { ERDSchema, Column } from '@/types/schema';
import { parseCreateTables } from '@/features/sql/sql-parser';
import { generateDDL } from '@/features/sql/ddl-generator';
import type { Dialect, DialectCaps, CanonicalType, SchemaDiff } from './types';
import { deriveCanonical, renderTypeWithArgs } from './canonical';
import { attachAlterForeignKeys, attachUniqueConstraints } from './alter-fk';
import { quote, isReservedIn, generateAlterFor } from './shared';

const CAPS: DialectCaps = {
  identifierQuote: '`',
  schemas: false, // MySQL 의 "schema" 는 database 와 동의어 — ERD 모델에선 비사용 취급
  autoIncrement: 'autoincrement', // AUTO_INCREMENT 키워드
  enumStyle: 'native', // ENUM('a','b')
  inlineForeignKeys: false, // ddl-generator 는 ALTER 로 분리
  alterAddConstraint: true,
  partialIndexes: false,
  expressionIndexes: true, // 8.0.13+
  checkConstraints: true, // 8.0.16+
  engineCharset: true,
  sequences: false,
  identifierMaxLen: 64,
};

// canonical base → MySQL native
function mapCanonical(canon: CanonicalType, col: Column): string {
  const base = canon.base;
  const unsigned = canon.unsigned ? ' UNSIGNED' : '';
  switch (base) {
    case 'BOOLEAN':
      return 'TINYINT(1)';
    case 'INTEGER':
      return `INT${unsigned}`;
    case 'SMALLINT':
      return `SMALLINT${unsigned}`;
    case 'BIGINT':
      return `BIGINT${unsigned}`;
    case 'FLOAT':
      return 'FLOAT';
    case 'DOUBLE':
      return 'DOUBLE';
    case 'DECIMAL':
      return renderTypeWithArgs('DECIMAL', canon.args);
    case 'VARCHAR':
      return renderTypeWithArgs('VARCHAR', canon.args ?? [255]);
    case 'CHAR':
      return renderTypeWithArgs('CHAR', canon.args);
    case 'TEXT':
      return 'TEXT';
    case 'BLOB':
      return 'BLOB';
    case 'JSON':
      return 'JSON';
    case 'UUID':
      return 'CHAR(36)';
    case 'DATETIME':
      return 'DATETIME';
    case 'TIMESTAMP':
      return 'TIMESTAMP';
    case 'DATE':
      return 'DATE';
    case 'TIME':
      return 'TIME';
    case 'ENUM': {
      const vals = canon.enumValues ?? col.enumValues ?? [];
      if (vals.length > 0) return `ENUM(${vals.map((v) => `'${v}'`).join(', ')})`;
      return 'VARCHAR(255)';
    }
    default:
      // 알 수 없는 타입 — 원본 보존
      return canon.raw ?? renderTypeWithArgs(base, canon.args);
  }
}

const RESERVED = new Set([
  'ADD',
  'ALTER',
  'AUTO_INCREMENT',
  'BETWEEN',
  'BY',
  'CONSTRAINT',
  'CREATE',
  'DEFAULT',
  'DELETE',
  'DROP',
  'FOREIGN',
  'FROM',
  'GROUP',
  'INDEX',
  'INSERT',
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

export const mysqlDialect: Dialect = {
  id: 'mysql',
  displayName: 'MySQL',
  caps: CAPS,

  parse(ddl: string): { schema: ERDSchema; warnings: string[] } {
    const schema = parseCreateTables(ddl); // CREATE TABLE 본문(인라인/테이블레벨 FK 포함)
    attachUniqueConstraints(schema, ddl); // 테이블레벨 단일컬럼 UNIQUE 회복
    attachAlterForeignKeys(schema, ddl); // 분리된 ALTER FK 보강
    return { schema, warnings: [] };
  },

  generate(schema: ERDSchema): string {
    return generateDDL(schema, 'mysql');
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
