import type { Column } from './schema';

export interface NodePosition {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type TableNodeData = Record<string, unknown> & {
  tableId: string;
  tableName: string;
  columns: Column[];
  fkColumnIds: string[];
};
