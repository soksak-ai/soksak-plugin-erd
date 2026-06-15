import type { ReferentialAction } from '@/types/schema';

export interface AddForeignKeyParams {
  name?: string;
  table: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
}

export interface DropForeignKeyParams {
  table: string;
  name: string;
  _fkData?: AddForeignKeyParams;
}

export interface AddPrimaryKeyParams {
  table: string;
  columns: string[];
}

export interface DropPrimaryKeyParams {
  table: string;
  columns: string[];
}

export interface AddUniqueConstraintParams {
  table: string;
  name?: string;
  columns: string[];
}

export interface DropUniqueConstraintParams {
  table: string;
  name: string;
  columns?: string[];
}
