import type { ERDSchema, Column } from '@/types/schema';

// ── Dialect 식별자 ────────────────────────────────────────────────────────
// 멀티-DB 확장 시 여기에 추가. 기존 SQLDialect('mysql'|'postgresql')의 상위집합.
export type DialectId = 'sqlite' | 'mysql' | 'postgresql';

// ── 정규(canonical) 타입 모델 ─────────────────────────────────────────────
// Column.dataType(string, 사용자 입력 native)는 단일 진실로 유지한다.
// CanonicalType 은 그로부터 lazy 파생되는 중간표현 — 영속화/저장 금지.
export interface CanonicalType {
  /** 표준 base 식별자(대문자). 예: VARCHAR, INTEGER, DECIMAL, ENUM. */
  base: string;
  /** 길이/정밀도 인자. VARCHAR(255)→[255], DECIMAL(10,2)→[10,2]. */
  args?: number[];
  /** MySQL UNSIGNED 등 부호 한정자. */
  unsigned?: boolean;
  /** ENUM/SET 값 목록. */
  enumValues?: string[];
  /** 표준화 실패 시 원본 native 문자열(매핑 폴백용). */
  raw?: string;
}

// ── Dialect 능력(capabilities) 표 ─────────────────────────────────────────
// 각 DB 의 DDL 문법 차이를 데이터로 기술. generate/parse 분기는 이 표를 본다.
export interface DialectCaps {
  /** 식별자 인용 부호. MySQL=` , PG/SQLite=" */
  identifierQuote: string;
  /** 스키마(네임스페이스) 지원 여부. SQLite=false */
  schemas: boolean;
  /** 자동증가 실현 방식. */
  autoIncrement: 'serial' | 'identity' | 'autoincrement' | 'sequence';
  /** ENUM 표현 방식. native(MySQL) | check(PG/SQLite CHECK) | lookup(별도 테이블) */
  enumStyle: 'native' | 'check' | 'lookup';
  /** CREATE TABLE 내부에 FK 를 인라인으로 넣는지(SQLite=true). false 면 ALTER 로 분리. */
  inlineForeignKeys: boolean;
  /** ALTER TABLE ADD CONSTRAINT 지원 여부(SQLite=false). */
  alterAddConstraint: boolean;
  /** 부분 인덱스(WHERE) 지원. */
  partialIndexes: boolean;
  /** 표현식 인덱스 지원. */
  expressionIndexes: boolean;
  /** CHECK 제약 지원. */
  checkConstraints: boolean;
  /** ENGINE/CHARSET 절 지원(MySQL 전용). */
  engineCharset: boolean;
  /** SEQUENCE 객체 지원(PG). */
  sequences: boolean;
  /** 식별자 최대 길이. */
  identifierMaxLen: number;
}

// ── 스키마 diff(generateAlter 입력) ──────────────────────────────────────
// 최소 구조 — 테이블/컬럼/관계의 추가·삭제. 이름 기반(ID 비의존).
export interface SchemaDiff {
  addedTables: string[]; // 테이블 이름
  droppedTables: string[];
  addedColumns: Array<{ table: string; column: Column }>;
  droppedColumns: Array<{ table: string; column: string }>;
  addedRelationships: Array<{
    name?: string;
    table: string; // FK 보유 테이블(target)
    columns: string[]; // FK 컬럼
    refTable: string; // 참조 테이블(source)
    refColumns: string[];
    onDelete: string;
    onUpdate: string;
  }>;
  droppedRelationships: Array<{ name: string; table: string }>;
}

// ── Dialect 인터페이스 ────────────────────────────────────────────────────
export interface Dialect {
  id: DialectId;
  displayName: string;
  caps: DialectCaps;

  /** DDL 문자열을 파싱해 ERDSchema 모델 + 경고를 반환. */
  parse(ddl: string): { schema: ERDSchema; warnings: string[] };
  /** ERDSchema 모델을 이 dialect 의 CREATE 문 DDL 로 직렬화. */
  generate(schema: ERDSchema): string;
  /** 스키마 diff 를 ALTER 계열 DDL 로 직렬화. */
  generateAlter(diff: SchemaDiff): string;

  /** 식별자를 dialect 인용 부호로 감싼다. */
  quoteIdent(name: string): string;
  /** 예약어 여부. */
  isReserved(word: string): boolean;
  /** canonical 타입 + 컬럼 컨텍스트를 native 타입 문자열로 매핑. */
  mapType(canonical: CanonicalType, col: Column): string;
  /** native 타입 문자열을 canonical 로 역매핑. */
  parseType(native: string): CanonicalType;
}
