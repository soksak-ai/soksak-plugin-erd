export type {
  OperationType,
  Operation,
  MigrationVersion,
  MigrationHistory,
} from './types';

export {
  generateInverse,
  applyOperation,
  restoreToVersion,
} from './operations';

export type {
  CreateTableParams,
  DropTableParams,
  RenameTableParams,
  AddColumnParams,
  DropColumnParams,
  RenameColumnParams,
  ModifyColumnTypeParams,
  ModifyColumnDefaultParams,
  SetColumnNullableParams,
  SetColumnAutoIncrementParams,
  SetColumnUniqueParams,
  AddForeignKeyParams,
  DropForeignKeyParams,
  AddPrimaryKeyParams,
  DropPrimaryKeyParams,
  AddUniqueConstraintParams,
  DropUniqueConstraintParams,
  CreateIndexParams,
  DropIndexParams,
} from './operations';

export { getSQLGenerator, MySQLGenerator, PostgreSQLGenerator, SQLiteGenerator } from './sql-generator';
export type { SQLGenerator } from './sql-generator';
