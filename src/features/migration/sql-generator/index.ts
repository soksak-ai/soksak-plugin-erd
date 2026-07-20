import type { DialectId } from '@/features/db/dialect/types';
import type { SQLGenerator } from './types';
import { MySQLGenerator } from './mysql-generator';
import { PostgreSQLGenerator } from './postgresql-generator';
import { SQLiteGenerator } from './sqlite-generator';

const generators: Record<DialectId, SQLGenerator> = {
  sqlite: new SQLiteGenerator(),
  mysql: new MySQLGenerator(),
  postgresql: new PostgreSQLGenerator(),
};

export function getSQLGenerator(dialect: DialectId): SQLGenerator {
  return generators[dialect];
}

// Split a generated DDL batch into individual statements. generateBatch joins ops with
// blank lines and terminates statements with `;`. Split on `;`, drop `--` comment spans
// (unsupported-op notes and headers) and empties, re-terminate each survivor. Single source
// for both the runtime migration-run command and the view's forward-apply path.
export function splitStatements(batch: string): string[] {
  return batch
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter((s) => s.length > 0)
    .map((s) => `${s};`);
}

export { MySQLGenerator, PostgreSQLGenerator, SQLiteGenerator };
export type { SQLGenerator };
