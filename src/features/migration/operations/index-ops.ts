export interface CreateIndexParams {
  table: string;
  name: string;
  columns: string[];
  unique: boolean;
}

export interface DropIndexParams {
  table: string;
  name: string;
  _indexData?: CreateIndexParams;
}
