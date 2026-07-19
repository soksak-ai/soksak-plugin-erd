// Undo/redo history contract.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { createSchemaSlice } from '@/store/slices/schema-slice';
import { createDiagramSlice } from '@/store/slices/diagram-slice';
import { createUISlice } from '@/store/slices/ui-slice';
import type { StoreState } from '@/store/index';
import { createHistory, type HistoryController } from './history';

setAutoFreeze(false);

function makeStore() {
  return createStore<StoreState>()(
    immer((...a) => ({
      ...createSchemaSlice(...a),
      ...createDiagramSlice(...a),
      ...createUISlice(...a),
    })),
  );
}

// 시계 주입 — 각 편집을 coalesce 창 밖으로 밀어 개별 undo 스텝이 되게 한다.
function stepClock() {
  let t = 0;
  return { now: () => t, tick: (ms = 1000) => { t += ms; } };
}

function tableCount(store: ReturnType<typeof makeStore>) {
  return Object.keys(store.getState().tables).length;
}

describe('undo/redo history', () => {
  let store: ReturnType<typeof makeStore>;
  let clock: ReturnType<typeof stepClock>;
  let h: HistoryController;

  beforeEach(() => {
    store = makeStore();
    clock = stepClock();
    h = createHistory(store as any, { now: clock.now });
  });

  it('starts empty — nothing to undo or redo', () => {
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe(false);
    expect(h.redo()).toBe(false);
  });

  it('undoes a table creation', () => {
    clock.tick();
    store.getState().addTable({ name: 'users', columns: [] });
    expect(tableCount(store)).toBe(1);
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toBe(true);
    expect(tableCount(store)).toBe(0);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });

  it('redoes an undone creation', () => {
    clock.tick();
    store.getState().addTable({ name: 'users', columns: [] });
    h.undo();
    expect(tableCount(store)).toBe(0);
    expect(h.redo()).toBe(true);
    expect(tableCount(store)).toBe(1);
    expect(store.getState().tables[Object.keys(store.getState().tables)[0]].name).toBe('users');
  });

  it('walks multiple steps back and forward', () => {
    for (const n of ['a', 'b', 'c']) {
      clock.tick();
      store.getState().addTable({ name: n, columns: [] });
    }
    expect(tableCount(store)).toBe(3);
    h.undo(); h.undo();
    expect(tableCount(store)).toBe(1);
    h.redo();
    expect(tableCount(store)).toBe(2);
    h.undo(); h.undo();
    expect(tableCount(store)).toBe(0);
  });

  it('a new edit after undo clears the redo future', () => {
    clock.tick();
    store.getState().addTable({ name: 'a', columns: [] });
    h.undo();
    expect(h.canRedo()).toBe(true);
    clock.tick();
    store.getState().addTable({ name: 'b', columns: [] });
    expect(h.canRedo()).toBe(false); // future branch dropped
    h.undo();
    expect(tableCount(store)).toBe(0);
  });

  it('coalesces a burst of edits within the window into one step', () => {
    const id = store.getState().addTable({ name: 't', columns: [] });
    // 같은 창(now 불변) 안에서 이름을 3번 바꾼다 → 한 스텝으로 접힘.
    store.getState().updateTable(id, { name: 't1' });
    store.getState().updateTable(id, { name: 't2' });
    store.getState().updateTable(id, { name: 't3' });
    expect(h.status().past).toBe(1); // create + burst rename = 1 step (same window)
    h.undo();
    expect(tableCount(store)).toBe(0); // returns to before the whole burst
  });

  it('does not record its own undo/redo applies', () => {
    clock.tick();
    store.getState().addTable({ name: 'a', columns: [] });
    clock.tick();
    store.getState().addTable({ name: 'b', columns: [] });
    const before = h.status().past;
    h.undo();
    h.redo();
    // apply 는 새 past 엔트리를 만들지 않는다(applying 가드).
    expect(h.status().past).toBe(before);
  });

  it('caps the past stack', () => {
    const capped = createHistory(store as any, { now: clock.now, cap: 3 });
    for (let i = 0; i < 6; i++) {
      clock.tick();
      store.getState().addTable({ name: `t${i}`, columns: [] });
    }
    expect(capped.status().past).toBe(3);
    capped.dispose();
  });

  it('undo restores dialect changes', () => {
    clock.tick();
    store.getState().setDialect('postgresql');
    expect(store.getState().dialect).toBe('postgresql');
    h.undo();
    expect(store.getState().dialect).toBe('mysql');
  });
});
