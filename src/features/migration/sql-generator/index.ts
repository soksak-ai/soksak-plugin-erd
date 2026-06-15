import type { SQLDialect } from '@/types/schema';
import type { SQLGenerator } from './types';
import { MySQLGenerator } from './mysql-generator';
import { PostgreSQLGenerator } from './postgresql-generator';

const generators: Record<SQLDialect, SQLGenerator> = {
  mysql: new MySQLGenerator(),
  postgresql: new PostgreSQLGenerator(),
};

export function getSQLGenerator(dialect: SQLDialect): SQLGenerator {
  return generators[dialect];
}

export { MySQLGenerator, PostgreSQLGenerator };
export type { SQLGenerator };
