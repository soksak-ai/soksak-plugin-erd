import type { Dialect, DialectId } from './types';
import { sqliteDialect } from './sqlite';
import { mysqlDialect } from './mysql';
import { postgresqlDialect } from './postgresql';

// ── dialect 레지스트리 ────────────────────────────────────────────────────
// 멀티-DB 진입점. 새 dialect 는 여기에 등록한다.
export const dialectRegistry: Record<DialectId, Dialect> = {
  sqlite: sqliteDialect,
  mysql: mysqlDialect,
  postgresql: postgresqlDialect,
};

/** id 로 dialect 를 가져온다. 미등록이면 throw. */
export function getDialect(id: DialectId): Dialect {
  const d = dialectRegistry[id];
  if (!d) throw new Error(`Unknown dialect: ${id}`);
  return d;
}

export type { Dialect, DialectId, DialectCaps, CanonicalType, SchemaDiff } from './types';
