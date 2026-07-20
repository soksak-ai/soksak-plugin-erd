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

export { MySQLGenerator, PostgreSQLGenerator, SQLiteGenerator };
export type { SQLGenerator };
