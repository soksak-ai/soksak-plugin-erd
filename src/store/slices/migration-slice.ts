import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import type { Operation, MigrationVersion } from '@/features/migration/types';
import type { SQLDialect } from '@/types/schema';
import { generateId } from '@/lib/id';
import { generateInverse } from '@/features/migration/operations/inverse';
import { getSQLGenerator } from '@/features/migration/sql-generator';

export interface MigrationSlice {
  migrationHistory: MigrationVersion[];
  uncommittedOps: Operation[];

  recordOperation: (type: Operation['type'], params: Record<string, unknown>) => void;
  commitVersion: (title: string) => void;
  getVersionSQL: (versionId: string, dialect: SQLDialect) => string;
  getUncommittedSQL: (dialect: SQLDialect) => string;
  getAllMigrationsSQL: (dialect: SQLDialect) => string;
  undoLastOperation: () => Operation | null;
}

export const createMigrationSlice: StateCreator<
  StoreState,
  [['zustand/immer', never]],
  [],
  MigrationSlice
> = (set, get) => ({
  migrationHistory: [],
  uncommittedOps: [],

  recordOperation: (type, params) => {
    set((state) => {
      state.uncommittedOps.push({
        id: generateId(),
        type,
        timestamp: Date.now(),
        params,
      });
    });
  },

  commitVersion: (title) => {
    set((state) => {
      if (state.uncommittedOps.length === 0) return;
      const version: MigrationVersion = {
        id: generateId(),
        version: String(state.migrationHistory.length + 1).padStart(3, '0'),
        title,
        date: new Date().toISOString(),
        operations: [...state.uncommittedOps],
      };
      state.migrationHistory.push(version);
      state.uncommittedOps = [];
    });
  },

  getVersionSQL: (versionId, dialect) => {
    const state = get();
    const version = state.migrationHistory.find((v) => v.id === versionId);
    if (!version) return '';
    const generator = getSQLGenerator(dialect);
    return `-- Migration: ${version.version} - ${version.title}\n-- Date: ${version.date}\n\n${generator.generateBatch(version.operations)}`;
  },

  getUncommittedSQL: (dialect) => {
    const state = get();
    if (state.uncommittedOps.length === 0) return '-- No uncommitted changes';
    const generator = getSQLGenerator(dialect);
    return `-- Uncommitted changes\n\n${generator.generateBatch(state.uncommittedOps)}`;
  },

  getAllMigrationsSQL: (dialect) => {
    const state = get();
    const generator = getSQLGenerator(dialect);
    const sections = state.migrationHistory.map(
      (v) =>
        `-- Migration: ${v.version} - ${v.title}\n-- Date: ${v.date}\n\n${generator.generateBatch(v.operations)}`,
    );
    return sections.join('\n\n-- ========================================\n\n');
  },

  undoLastOperation: () => {
    const state = get();
    const ops = state.uncommittedOps;
    if (ops.length === 0) return null;
    const lastOp = ops[ops.length - 1];
    const inverse = generateInverse(lastOp);
    set((s) => {
      s.uncommittedOps.pop();
    });
    return inverse;
  },
});
