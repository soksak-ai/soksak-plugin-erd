export type OperationType =
  // Table
  | 'createTable'
  | 'dropTable'
  | 'renameTable'
  // Column
  | 'addColumn'
  | 'dropColumn'
  | 'renameColumn'
  | 'modifyColumnType'
  | 'modifyColumnDefault'
  | 'setColumnNullable'
  | 'setColumnAutoIncrement'
  | 'setColumnUnique'
  // Constraint
  | 'addPrimaryKey'
  | 'dropPrimaryKey'
  | 'addForeignKey'
  | 'dropForeignKey'
  | 'addUniqueConstraint'
  | 'dropUniqueConstraint'
  // Index
  | 'createIndex'
  | 'dropIndex';

export interface Operation {
  id: string;
  type: OperationType;
  timestamp: number;
  params: Record<string, unknown>;
}

export interface MigrationVersion {
  id: string;
  version: string;
  title: string;
  date: string; // ISO 8601
  operations: Operation[];
}

export interface MigrationHistory {
  versions: MigrationVersion[];
  uncommittedOps: Operation[];
}
