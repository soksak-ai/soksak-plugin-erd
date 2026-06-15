// SQL 데이터타입 ↔ 포맷별 스칼라 타입 매핑(단일 진실).
// prisma.ts / dbml.ts 가 공유 — 인라인 재정의 금지.

// SQL 베이스 타입(괄호·UNSIGNED 등 제거된 대문자) → Prisma 스칼라
const SQL_TO_PRISMA: Record<string, string> = {
  INT: 'Int',
  INTEGER: 'Int',
  SMALLINT: 'Int',
  TINYINT: 'Int',
  BIGINT: 'BigInt',
  SERIAL: 'Int',
  BIGSERIAL: 'BigInt',
  DECIMAL: 'Decimal',
  NUMERIC: 'Decimal',
  FLOAT: 'Float',
  DOUBLE: 'Float',
  REAL: 'Float',
  VARCHAR: 'String',
  CHAR: 'String',
  TEXT: 'String',
  LONGTEXT: 'String',
  UUID: 'String',
  BOOL: 'Boolean',
  BOOLEAN: 'Boolean',
  DATE: 'DateTime',
  DATETIME: 'DateTime',
  TIMESTAMP: 'DateTime',
  TIME: 'DateTime',
  JSON: 'Json',
  JSONB: 'Json',
  BYTEA: 'Bytes',
  BLOB: 'Bytes',
};

// Prisma 스칼라 → SQL 베이스 타입(역매핑 대표값)
const PRISMA_TO_SQL: Record<string, string> = {
  Int: 'INT',
  BigInt: 'BIGINT',
  Decimal: 'DECIMAL',
  Float: 'FLOAT',
  String: 'VARCHAR',
  Boolean: 'BOOLEAN',
  DateTime: 'TIMESTAMP',
  Json: 'JSON',
  Bytes: 'BYTEA',
};

// DBML 은 SQL 타입을 거의 그대로 쓴다. 정규화(소문자)만 적용하고
// 미지원 케이스 없이 통과 — 대표 별칭만 표준화.
const SQL_TO_DBML: Record<string, string> = {
  INT: 'int',
  INTEGER: 'integer',
  BIGINT: 'bigint',
  SMALLINT: 'smallint',
  TINYINT: 'tinyint',
  DECIMAL: 'decimal',
  NUMERIC: 'numeric',
  FLOAT: 'float',
  DOUBLE: 'double',
  VARCHAR: 'varchar',
  CHAR: 'char',
  TEXT: 'text',
  BOOL: 'boolean',
  BOOLEAN: 'boolean',
  DATE: 'date',
  DATETIME: 'datetime',
  TIMESTAMP: 'timestamp',
  JSON: 'json',
  UUID: 'uuid',
};

// 괄호·부호 수식어를 떼어낸 베이스 타입(대문자) 추출.
export function baseSqlType(dataType: string): string {
  return dataType
    .toUpperCase()
    .replace(/\(.*\)/, '')
    .replace(/\b(UNSIGNED|SIGNED|ZEROFILL)\b/g, '')
    .trim();
}

// SQL 타입 → Prisma 스칼라(미지원이면 fallback 과 경고).
export function sqlToPrisma(dataType: string): { type: string; warning?: string } {
  const base = baseSqlType(dataType);
  const mapped = SQL_TO_PRISMA[base];
  if (mapped) return { type: mapped };
  return { type: 'String', warning: `미지원 SQL 타입 "${dataType}" → Prisma String 으로 대체` };
}

// Prisma 스칼라 → SQL 타입(미지원이면 그대로 대문자 + 경고).
export function prismaToSql(prismaType: string): { type: string; warning?: string } {
  const mapped = PRISMA_TO_SQL[prismaType];
  if (mapped) return { type: mapped };
  return { type: prismaType.toUpperCase(), warning: `미지원 Prisma 타입 "${prismaType}" — 원형 유지` };
}

// SQL 타입 → DBML 타입(소문자 정규화). 길이는 별도 처리.
export function sqlToDbml(dataType: string): string {
  const base = baseSqlType(dataType);
  return SQL_TO_DBML[base] ?? base.toLowerCase();
}

// DBML 타입 → SQL 베이스 타입(대문자). DBML 은 SQL 친화적이라 대문자화만.
export function dbmlToSql(dbmlType: string): string {
  return dbmlType.toUpperCase().replace(/\(.*\)/, '').trim();
}
