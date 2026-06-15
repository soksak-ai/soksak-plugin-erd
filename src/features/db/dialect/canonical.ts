import type { Column } from '@/types/schema';
import type { CanonicalType } from './types';

// ── 표준 canonical base 목록 ──────────────────────────────────────────────
// dialect 중립 타입 어휘. native 별칭은 ALIAS 로 흡수해 이 집합으로 정규화.
export const CANONICAL_BASES = [
  'BOOLEAN',
  'SMALLINT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'FLOAT',
  'DOUBLE',
  'CHAR',
  'VARCHAR',
  'TEXT',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'DATETIME',
  'BLOB',
  'JSON',
  'UUID',
  'ENUM',
] as const;

// native base 별칭 → canonical base. 대문자 기준.
const BASE_ALIAS: Record<string, string> = {
  INT: 'INTEGER',
  INT4: 'INTEGER',
  INTEGER: 'INTEGER',
  INT2: 'SMALLINT',
  SMALLINT: 'SMALLINT',
  INT8: 'BIGINT',
  BIGINT: 'BIGINT',
  BOOL: 'BOOLEAN',
  BOOLEAN: 'BOOLEAN',
  TINYINT: 'BOOLEAN', // 관용: TINYINT(1) ↔ BOOLEAN
  NUMERIC: 'DECIMAL',
  DECIMAL: 'DECIMAL',
  REAL: 'FLOAT',
  FLOAT: 'FLOAT',
  FLOAT4: 'FLOAT',
  DOUBLE: 'DOUBLE',
  'DOUBLE PRECISION': 'DOUBLE',
  FLOAT8: 'DOUBLE',
  CHARACTER: 'CHAR',
  CHAR: 'CHAR',
  'CHARACTER VARYING': 'VARCHAR',
  VARCHAR: 'VARCHAR',
  VARCHAR2: 'VARCHAR',
  TEXT: 'TEXT',
  CLOB: 'TEXT',
  DATE: 'DATE',
  TIME: 'TIME',
  TIMESTAMP: 'TIMESTAMP',
  TIMESTAMPTZ: 'TIMESTAMP',
  DATETIME: 'DATETIME',
  BLOB: 'BLOB',
  BYTEA: 'BLOB',
  JSON: 'JSON',
  JSONB: 'JSON',
  UUID: 'UUID',
  ENUM: 'ENUM',
  SET: 'ENUM',
};

// SQLite affinity 폴백(알 수 없는 base 의 affinity 추정).
export function sqliteAffinity(base: string): 'INTEGER' | 'TEXT' | 'REAL' | 'NUMERIC' | 'BLOB' {
  const b = base.toUpperCase();
  if (b.includes('INT')) return 'INTEGER';
  if (b.includes('CHAR') || b.includes('CLOB') || b.includes('TEXT')) return 'TEXT';
  if (b === 'BLOB') return 'BLOB';
  if (b.includes('REAL') || b.includes('FLOA') || b.includes('DOUB')) return 'REAL';
  return 'NUMERIC';
}

// ── native 타입 문자열 파싱 ──────────────────────────────────────────────
// "VARCHAR(255)", "DECIMAL(10, 2)", "INT UNSIGNED", "ENUM('a','b')" 등.
export function parseNativeType(native: string): CanonicalType {
  const raw = native.trim();
  const upper = raw.toUpperCase();

  // ENUM/SET 값 추출
  const enumMatch = upper.match(/^(ENUM|SET)\s*\(([^)]*)\)/);
  if (enumMatch) {
    const values = enumMatch[2]
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''))
      .filter((v) => v.length > 0);
    return { base: 'ENUM', enumValues: values, raw };
  }

  // 부호 한정자 탐지(제거 후 base 추출)
  const unsigned = /\bUNSIGNED\b/.test(upper);
  const stripped = upper.replace(/\b(UNSIGNED|SIGNED|ZEROFILL)\b/g, '').trim();

  // base(args) 형태 — DOUBLE PRECISION 같은 두 단어 base 도 수용
  const m = stripped.match(/^([A-Z0-9_ ]+?)\s*(?:\(([^)]*)\))?$/);
  const rawBase = (m?.[1] ?? stripped).trim();
  const argStr = m?.[2];

  const base = BASE_ALIAS[rawBase] ?? rawBase;
  const args = argStr
    ? argStr
        .split(',')
        .map((a) => parseInt(a.trim(), 10))
        .filter((n) => !Number.isNaN(n))
    : undefined;

  const canon: CanonicalType = { base, raw };
  if (args && args.length > 0) canon.args = args;
  if (unsigned) canon.unsigned = true;
  return canon;
}

// ── 단일 유틸: Column → CanonicalType (lazy 파생) ─────────────────────────
// Column.dataType 는 절대 변경하지 않는다. enumValues 가 컬럼에 있으면 우선 사용.
export function deriveCanonical(col: Column): CanonicalType {
  const canon = parseNativeType(col.dataType);
  if (col.enumValues && col.enumValues.length > 0) {
    canon.base = 'ENUM';
    canon.enumValues = col.enumValues;
  }
  return canon;
}

// ── canonical 직렬화(공통 헬퍼) ──────────────────────────────────────────
// base + args 를 "BASE(a, b)" 로 재조립. dialect mapType 에서 재사용.
export function renderTypeWithArgs(base: string, args?: number[]): string {
  if (args && args.length > 0) return `${base}(${args.join(', ')})`;
  return base;
}
