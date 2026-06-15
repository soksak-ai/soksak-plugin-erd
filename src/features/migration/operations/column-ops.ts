export interface AddColumnParams {
  table: string;
  name: string;
  dataType: string;
  nullable?: boolean;
  defaultValue?: string;
  autoIncrement?: boolean;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  after?: string; // column to add after (MySQL)
}

export interface DropColumnParams {
  table: string;
  name: string;
  _columnData?: AddColumnParams;
}

export interface RenameColumnParams {
  table: string;
  oldName: string;
  newName: string;
}

export interface ModifyColumnTypeParams {
  table: string;
  column: string;
  oldType: string;
  newType: string;
}

export interface ModifyColumnDefaultParams {
  table: string;
  column: string;
  oldDefault?: string;
  newDefault?: string;
}

export interface SetColumnNullableParams {
  table: string;
  column: string;
  nullable: boolean;
  oldNullable: boolean;
}

export interface SetColumnAutoIncrementParams {
  table: string;
  column: string;
  autoIncrement: boolean;
}

export interface SetColumnUniqueParams {
  table: string;
  column: string;
  unique: boolean;
}
