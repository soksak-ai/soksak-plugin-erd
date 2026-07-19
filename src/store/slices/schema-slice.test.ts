// addTable id-assignment contract — every column and index must carry a stable id,
// even when the caller (create-table command, apply batch, importers) supplies
// partial column definitions without ids. Prior to this, command-created columns
// had id === undefined, which broke updateColumn and crashed id-derived UI.
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';

beforeEach(() => {
  useStore.getState().resetSchema();
});

describe('addTable — column/index id assignment', () => {
  it('assigns ids to columns supplied without one', () => {
    const tid = useStore.getState().addTable({
      name: 'users',
      columns: [
        { name: 'id', dataType: 'INT', isPrimaryKey: true } as never,
        { name: 'email', dataType: 'VARCHAR(255)' } as never,
      ],
    });
    const cols = useStore.getState().tables[tid].columns;
    expect(cols).toHaveLength(2);
    for (const c of cols) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
    }
    // ids are unique
    expect(new Set(cols.map((c) => c.id)).size).toBe(2);
  });

  it('preserves an id the caller already provided', () => {
    const tid = useStore.getState().addTable({
      name: 't',
      columns: [{ id: 'keep-me', name: 'id', dataType: 'INT' } as never],
    });
    expect(useStore.getState().tables[tid].columns[0].id).toBe('keep-me');
  });

  it('assigns ids to indexes supplied without one', () => {
    const tid = useStore.getState().addTable({
      name: 't',
      columns: [{ name: 'id', dataType: 'INT' } as never],
      indexes: [{ name: 'idx_a', columnIds: [], unique: false } as never],
    });
    const idx = useStore.getState().tables[tid].indexes;
    expect(idx).toHaveLength(1);
    expect(typeof idx[0].id).toBe('string');
    expect(idx[0].id.length).toBeGreaterThan(0);
  });

  it('a command-style column can then be updated by its assigned id', () => {
    const tid = useStore.getState().addTable({
      name: 't',
      columns: [{ name: 'email', dataType: 'VARCHAR(255)' } as never],
    });
    const col = useStore.getState().tables[tid].columns[0];
    useStore.getState().updateColumn(tid, col.id, { dataType: 'TEXT' });
    expect(useStore.getState().tables[tid].columns[0].dataType).toBe('TEXT');
  });
});
