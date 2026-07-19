// Command palette action registry contract.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPaletteActions } from './actions';
import { useStore } from '@/store';

// focus-table / history 는 useStore 를 통해 동작 — 실제 store 로 검증한다.
beforeEach(() => {
  useStore.getState().resetSchema();
  useStore.getState().resetDiagram();
});

describe('buildPaletteActions', () => {
  it('includes the core static actions with stable ids and groups', () => {
    const ids = new Set(buildPaletteActions().map((a) => a.id));
    for (const id of [
      'new-table', 'import-sql', 'import-mermaid', 'import-mwb',
      'undo', 'redo', 'select-all', 'clear-selection',
      'auto-layout', 'fit-view', 'toggle-left', 'toggle-right', 'toggle-bottom',
      'dialect-mysql', 'dialect-postgresql',
    ]) {
      expect(ids.has(id), `missing action: ${id}`).toBe(true);
    }
  });

  it('adds one Jump action per table', () => {
    const a = useStore.getState().addTable({ name: 'users', columns: [] });
    const b = useStore.getState().addTable({ name: 'orders', columns: [] });
    const jumps = buildPaletteActions().filter((x) => x.group === 'Navigate');
    expect(jumps.map((x) => x.id).sort()).toEqual([`jump:${a}`, `jump:${b}`].sort());
    expect(jumps.find((x) => x.id === `jump:${a}`)!.label).toBe('Jump to users');
  });

  it('new-table action opens the create dialog', () => {
    buildPaletteActions().find((x) => x.id === 'new-table')!.run();
    expect(useStore.getState().createTableDialogOpen).toBe(true);
  });

  it('dialect action switches the store dialect', () => {
    buildPaletteActions().find((x) => x.id === 'dialect-postgresql')!.run();
    expect(useStore.getState().dialect).toBe('postgresql');
  });

  it('select-all selects every table', () => {
    useStore.getState().addTable({ name: 'a', columns: [] });
    useStore.getState().addTable({ name: 'b', columns: [] });
    buildPaletteActions().find((x) => x.id === 'select-all')!.run();
    expect(useStore.getState().selectedNodeIds.length).toBe(2);
  });

  it('jump action selects the table', () => {
    const id = useStore.getState().addTable({ name: 'x', columns: [] });
    buildPaletteActions().find((a) => a.id === `jump:${id}`)!.run();
    expect(useStore.getState().selectedNodeIds).toEqual([id]);
  });

  it('every action has a non-empty label and a run function', () => {
    for (const a of buildPaletteActions()) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(typeof a.run).toBe('function');
    }
  });
});
