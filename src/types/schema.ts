export type SQLDialect = 'mysql' | 'postgresql';

export type RelationType = '1:1' | '1:N' | 'N:M';
export type AnchorSide = 'left' | 'right' | 'top' | 'bottom';

export type ReferentialAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';

export interface ERDSchema {
  tables: Record<string, Table>;
  relationships: Record<string, Relationship>;
  layers: Record<string, Layer>;
}

export interface Table {
  id: string;
  name: string;
  schema?: string;
  columns: Column[];
  indexes: Index[];
  comment?: string;
  engine?: string;
  charset?: string;
  layerId?: string;
  color?: string;
}

export interface Column {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  autoIncrement: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  comment?: string;
  length?: number;
  precision?: number;
  scale?: number;
  enumValues?: string[];
}

export interface Relationship {
  id: string;
  name?: string;
  sourceTableId: string;
  targetTableId: string;
  type: RelationType;
  lineStyle?: 'dashed' | 'solid';
  sourceColumnIds: string[];
  targetColumnIds: string[];
  onDelete: ReferentialAction;
  onUpdate: ReferentialAction;
  sourceAnchor?: EdgeAnchor;
  targetAnchor?: EdgeAnchor;
  bendPoints?: EdgePoint[];
}

export interface EdgePoint {
  x: number;
  y: number;
}

export interface EdgeAnchor {
  side: AnchorSide;
  offset: number; // 0..1 on the chosen side
}

export interface Index {
  id: string;
  name: string;
  columnIds: string[];
  unique: boolean;
  type?: string;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  bounds: { x: number; y: number; w: number; h: number };
}
