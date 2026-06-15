import type { Column } from '@/types/schema';

export interface CreateTableParams {
  name: string;
  schema?: string;
  columns: Column[];
  engine?: string;
  charset?: string;
  comment?: string;
}

export interface DropTableParams {
  name: string;
  _tableData?: CreateTableParams;
}

export interface RenameTableParams {
  oldName: string;
  newName: string;
}
