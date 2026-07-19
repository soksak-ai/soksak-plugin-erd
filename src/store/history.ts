// Undo/redo — snapshot history of the document subtrees.
//
// The prior migration-slice op-log was dead (recordOperation had zero callers,
// redo was a stub). This replaces it with a working past/future stack that
// snapshots the durable document subtrees (schema + diagram + dialect — the same
// set persist.ts durably stores) on every mutation. Because immer produces a new
// object per set and never mutates the previous one, a snapshot is just the set
// of previous references — no deep clone needed.
//
// Capture: subscribe to the store; on a real durable change push the pre-change
// snapshot onto `past` and clear `future`. A short coalesce window folds a burst
// of edits (e.g. per-keystroke rename) into one undo step. Applying an undo/redo
// is guarded so it never records itself. The viewport (camera) is NOT part of
// history — undo must not move the camera.
import { create } from 'zustand';
import type { StoreState } from '@/store/index';
import type { Table, Relationship, SQLDialect } from '@/types/schema';
import type { NodePosition, Viewport } from '@/types/diagram';

export interface HistoryDoc {
  tables: Record<string, Table>;
  relationships: Record<string, Relationship>;
  nodePositions: Record<string, NodePosition>;
  collapsedNodes: Record<string, boolean>;
  dialect: SQLDialect;
}

export interface HistoryStore {
  getState(): StoreState;
  subscribe(listener: (state: StoreState, prev: StoreState) => void): () => void;
}

export interface HistoryController {
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  status(): { past: number; future: number };
  dispose(): void;
}

const DEFAULT_CAP = 100;
const DEFAULT_COALESCE_MS = 400;

// UI 반응용 얇은 store — 버튼 enable 상태만. 컨트롤러가 매 변경 시 갱신한다.
export const useHistoryStore = create<{ canUndo: boolean; canRedo: boolean }>(() => ({
  canUndo: false,
  canRedo: false,
}));

// non-React 소비자(커맨드 핸들러·GUI 버튼)용 얇은 위임 — 활성 컨트롤러로 라우팅.
let active: HistoryController | null = null;
export function undo(): boolean {
  return active ? active.undo() : false;
}
export function redo(): boolean {
  return active ? active.redo() : false;
}
// 이력 상태 표면(투명성) — 헤드리스 커맨드가 undo/redo 가능 여부·깊이를 읽는다.
export function historyStatus(): { canUndo: boolean; canRedo: boolean; past: number; future: number } {
  const s = active?.status() ?? { past: 0, future: 0 };
  return { canUndo: s.past > 0, canRedo: s.future > 0, past: s.past, future: s.future };
}

function snap(s: StoreState): HistoryDoc {
  return {
    tables: s.tables,
    relationships: s.relationships,
    nodePositions: s.nodePositions,
    collapsedNodes: s.collapsedNodes,
    dialect: s.dialect,
  };
}

function durableChanged(a: HistoryDoc, b: StoreState): boolean {
  return (
    a.tables !== b.tables ||
    a.relationships !== b.relationships ||
    a.nodePositions !== b.nodePositions ||
    a.collapsedNodes !== b.collapsedNodes ||
    a.dialect !== b.dialect
  );
}

export function createHistory(
  store: HistoryStore,
  opts?: { cap?: number; coalesceMs?: number; now?: () => number },
): HistoryController {
  const cap = opts?.cap ?? DEFAULT_CAP;
  const coalesceMs = opts?.coalesceMs ?? DEFAULT_COALESCE_MS;
  const now = opts?.now ?? (() => Date.now());

  const past: HistoryDoc[] = [];
  const future: HistoryDoc[] = [];
  let baseline = snap(store.getState()); // 마지막으로 기록된 상태(변경 전)
  let applying = false;
  let lastPushAt = -Infinity;

  const sync = () => {
    useHistoryStore.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });
  };

  const apply = (doc: HistoryDoc) => {
    applying = true;
    try {
      const st = store.getState();
      st.loadProject({ tables: doc.tables, relationships: doc.relationships });
      // viewport 은 이력 대상이 아니므로 현재 값을 유지한다.
      const vp: Viewport = st.viewport;
      st.loadDiagramState({
        nodePositions: doc.nodePositions,
        collapsedNodes: doc.collapsedNodes,
        viewport: vp,
      });
      if (st.dialect !== doc.dialect) st.setDialect(doc.dialect);
    } finally {
      applying = false;
    }
    baseline = snap(store.getState());
  };

  const unsubscribe = store.subscribe((s, p) => {
    if (applying) return;
    if (!durableChanged(baseline, s)) return;
    const t = now();
    if (t - lastPushAt > coalesceMs) {
      // 새 undo 스텝 — 변경 전(baseline) 스냅샷을 past 에 쌓고 future 를 비운다.
      past.push(baseline);
      if (past.length > cap) past.shift();
      future.length = 0;
    }
    lastPushAt = t;
    baseline = snap(s);
    void p;
    sync();
  });

  const controller: HistoryController = {
    undo() {
      if (past.length === 0) return false;
      future.push(snap(store.getState()));
      const doc = past.pop()!;
      apply(doc);
      lastPushAt = -Infinity; // undo 직후 편집은 새 스텝으로(코얼레스 리셋)
      sync();
      return true;
    },
    redo() {
      if (future.length === 0) return false;
      past.push(snap(store.getState()));
      const doc = future.pop()!;
      apply(doc);
      lastPushAt = -Infinity;
      sync();
      return true;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    status: () => ({ past: past.length, future: future.length }),
    dispose() {
      unsubscribe();
      if (active === controller) active = null;
    },
  };

  active = controller;
  sync();
  return controller;
}
