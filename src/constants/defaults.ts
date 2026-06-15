import type { Column, Table } from '@/types/schema';
import { generateId } from '@/lib/id';

export const createDefaultColumn = (overrides?: Partial<Column>): Column => ({
  id: generateId(),
  name: 'column',
  dataType: 'INT',
  nullable: true,
  autoIncrement: false,
  isPrimaryKey: false,
  isUnique: false,
  ...overrides,
});

export const createDefaultPKColumn = (overrides?: Partial<Column>): Column => ({
  id: generateId(),
  name: 'id',
  dataType: 'INT',
  nullable: false,
  autoIncrement: true,
  isPrimaryKey: true,
  isUnique: false,
  ...overrides,
});

export const createDefaultTable = (overrides?: Partial<Table>): Table => ({
  id: generateId(),
  name: 'new_table',
  columns: [createDefaultPKColumn()],
  indexes: [],
  ...overrides,
});

export const DEFAULT_DIALECT = 'mysql' as const;

export const ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE'] as const;

export const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'ascii'] as const;
