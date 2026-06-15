import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { Table, Column, Relationship } from '@/types/schema';
import { generateId } from '@/lib/id';
import { createDefaultPKColumn } from '@/constants/defaults';

export interface SchemaSlice {
  // State
  tables: Record<string, Table>;
  relationships: Record<string, Relationship>;

  // Table actions
  addTable: (table: Partial<Table> & { name: string }) => string;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  removeTable: (tableId: string) => void;
  duplicateTable: (tableId: string) => string | null;

  // Column actions
  addColumn: (tableId: string, column?: Partial<Column>) => void;
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void;
  removeColumn: (tableId: string, columnId: string) => void;
  reorderColumns: (tableId: string, columnIds: string[]) => void;

  // Relationship actions
  addRelationship: (rel: Omit<Relationship, 'id'>) => string;
  updateRelationship: (relId: string, updates: Partial<Relationship>) => void;
  removeRelationship: (relId: string) => void;

  // Project actions
  loadProject: (data: { tables: Record<string, Table>; relationships: Record<string, Relationship> }) => void;
  resetSchema: () => void;

  // Import actions
  loadSchema: (tables: Record<string, Table>, relationships: Record<string, Relationship>) => void;
  clearSchema: () => void;
}

export const createSchemaSlice: StateCreator<StoreState, [['zustand/immer', never]], [], SchemaSlice> = (set) => ({
  tables: {},
  relationships: {},

  addTable: (tableData) => {
    const id = generateId();
    const table: Table = {
      id,
      name: tableData.name,
      columns: tableData.columns ?? [createDefaultPKColumn()],
      indexes: tableData.indexes ?? [],
      schema: tableData.schema,
      comment: tableData.comment,
      engine: tableData.engine,
      charset: tableData.charset,
      layerId: tableData.layerId,
      color: tableData.color,
    };
    set((state) => {
      state.tables[id] = table;
    });
    return id;
  },

  updateTable: (tableId, updates) => {
    set((state) => {
      if (state.tables[tableId]) {
        Object.assign(state.tables[tableId], updates);
      }
    });
  },

  removeTable: (tableId) => {
    set((state) => {
      delete state.tables[tableId];
      for (const [relId, rel] of Object.entries(state.relationships)) {
        if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
          delete state.relationships[relId];
        }
      }
      state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== tableId);
    });
  },

  duplicateTable: (tableId) => {
    let newId: string | null = null;
    set((state) => {
      const original = state.tables[tableId];
      if (!original) return;
      newId = generateId();
      const duplicated: Table = {
        ...JSON.parse(JSON.stringify(original)),
        id: newId,
        name: `${original.name}_copy`,
        columns: original.columns.map(col => ({ ...col, id: generateId() })),
        indexes: original.indexes.map(idx => ({ ...idx, id: generateId() })),
      };
      state.tables[newId] = duplicated;
      const pos = state.nodePositions[tableId];
      if (pos) {
        state.nodePositions[newId] = { x: pos.x + 40, y: pos.y + 40 };
      }
    });
    return newId;
  },

  addColumn: (tableId, column) => {
    set((state) => {
      const table = state.tables[tableId];
      if (table) {
        table.columns.push({
          id: generateId(),
          name: column?.name ?? 'new_column',
          dataType: column?.dataType ?? 'VARCHAR',
          nullable: column?.nullable ?? true,
          autoIncrement: column?.autoIncrement ?? false,
          isPrimaryKey: column?.isPrimaryKey ?? false,
          isUnique: column?.isUnique ?? false,
          defaultValue: column?.defaultValue,
          comment: column?.comment,
          length: column?.length,
          precision: column?.precision,
          scale: column?.scale,
          enumValues: column?.enumValues,
        });
      }
    });
  },

  updateColumn: (tableId, columnId, updates) => {
    set((state) => {
      const table = state.tables[tableId];
      if (table) {
        const col = table.columns.find(c => c.id === columnId);
        if (col) {
          Object.assign(col, updates);
        }
      }
    });
  },

  removeColumn: (tableId, columnId) => {
    set((state) => {
      const table = state.tables[tableId];
      if (table) {
        table.columns = table.columns.filter(c => c.id !== columnId);
      }
    });
  },

  reorderColumns: (tableId, columnIds) => {
    set((state) => {
      const table = state.tables[tableId];
      if (table) {
        const columnMap = new Map(table.columns.map(c => [c.id, c]));
        table.columns = columnIds.map(id => columnMap.get(id)!).filter(Boolean);
      }
    });
  },

  addRelationship: (relData) => {
    const id = generateId();
    set((state) => {
      state.relationships[id] = { ...relData, id };
    });
    return id;
  },

  updateRelationship: (relId, updates) => {
    set((state) => {
      if (state.relationships[relId]) {
        Object.assign(state.relationships[relId], updates);
      }
    });
  },

  removeRelationship: (relId) => {
    set((state) => {
      delete state.relationships[relId];
      state.selectedEdgeIds = state.selectedEdgeIds.filter(id => id !== relId);
    });
  },

  loadProject: (data) => {
    set((state) => {
      state.tables = data.tables;
      state.relationships = data.relationships;
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },

  resetSchema: () => {
    set((state) => {
      state.tables = {};
      state.relationships = {};
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },

  loadSchema: (tables, relationships) => {
    set((state) => {
      Object.assign(state.tables, tables);
      Object.assign(state.relationships, relationships);
    });
  },

  clearSchema: () => {
    set((state) => {
      state.tables = {};
      state.relationships = {};
      state.nodePositions = {};
      state.collapsedNodes = {};
      state.selectedNodeIds = [];
      state.selectedEdgeIds = [];
    });
  },
});
