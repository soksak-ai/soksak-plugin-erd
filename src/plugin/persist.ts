// Durable persistence for the working schema — the plugin's restore contract.
//
// Rules (enforced by src/plugin/persist.test.ts — do not weaken):
// 1. One durable document, version-tagged, under kv key `doc:default` in the plugin's own
//    namespace. It holds exactly: schema (tables, relationships), diagram (nodePositions,
//    collapsedNodes, viewport), dialect. Selection, dialogs, theme, and the migration slice
//    are session state and never persist; .mig files remain the migration channel.
// 2. Storage is the host's `app.data.kv` surface (requires the "data" permission). When the
//    surface is absent, persistence is disabled and the plugin stays fully functional,
//    memory-only — persist-status reports why.
// 3. Lifecycle: hydrate during activate BEFORE command registration (headless callers can
//    never observe pre-restore state); the store subscriber is installed only after
//    hydrate resolves (hydration must not persist itself; an empty boot must not clobber
//    a stored document). hydrate never throws — failure degrades to an empty schema and
//    is reported via persist-status.
// 4. Writes are debounced (trailing 500ms) and serialized from the live store at flush
//    time. `persist-flush` forces a synchronous-order write (E2E determinism); dispose
//    fires a best-effort final flush. The loss window is at most one debounce interval.
// 5. Change detection is reference equality on the six durable subtrees (immer structural
//    sharing guarantees identity for untouched subtrees). Selection churn never flushes.
// 6. A stored document with a NEWER version than this build is never applied and never
//    overwritten: persistence disables itself instead of destroying forward data.
// 7. Cross-window: kv.watch rehydrates this window on foreign writes unless it has
//    unflushed local edits (local edits win; last writer wins at the store). Self echoes
//    are filtered by savedAt identity.
import type { StoreState } from '@/store/index';
import type { Table, Relationship, SQLDialect } from '@/types/schema';
import type { NodePosition, Viewport } from '@/types/diagram';

export const PERSIST_KEY = 'doc:default';
export const PERSIST_DOC_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 500;

export interface PersistDoc {
  v: number;
  savedAt: number;
  schema: {
    tables: Record<string, Table>;
    relationships: Record<string, Relationship>;
  };
  diagram: {
    nodePositions: Record<string, NodePosition>;
    collapsedNodes: Record<string, boolean>;
    viewport: Viewport;
  };
  dialect: SQLDialect;
}

// 호스트 app.data.kv 표면 중 persistence 가 쓰는 부분(ns 는 호스트가 주입).
export interface DataKv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  watch?(cb: (key: string) => void): () => void;
}

// zustand store 표면 중 persistence 가 쓰는 최소 계약(react/vanilla 공통).
export interface PersistStore {
  getState(): StoreState;
  subscribe(listener: (state: StoreState, prev: StoreState) => void): () => void;
}

export interface PersistStatus {
  enabled: boolean;
  hydrated: boolean;
  restored: boolean;
  dirty: boolean;
  pendingFlush: boolean;
  lastSavedAt: number | null;
  lastError: string | null;
  disabled: string | null;
}

export interface Persistence {
  hydrate(): Promise<void>;
  rehydrate(): Promise<boolean>;
  flush(): Promise<boolean>;
  status(): PersistStatus;
  dispose(): void;
}

// 살아있는 store 상태 → 내구 문서(규칙 1의 여섯 subtree만).
export function serializeDoc(s: StoreState): PersistDoc {
  return {
    v: PERSIST_DOC_VERSION,
    savedAt: Date.now(),
    schema: { tables: s.tables, relationships: s.relationships },
    diagram: {
      nodePositions: s.nodePositions,
      collapsedNodes: s.collapsedNodes,
      viewport: s.viewport,
    },
    dialect: s.dialect,
  };
}

// 내구 문서 → store. 기존 원자 액션(loadProject/loadDiagramState/setDialect)만 사용한다.
export function applyDoc(store: PersistStore, doc: PersistDoc): void {
  const st = store.getState();
  st.loadProject({
    tables: doc.schema?.tables ?? {},
    relationships: doc.schema?.relationships ?? {},
  });
  st.loadDiagramState({
    nodePositions: doc.diagram?.nodePositions ?? {},
    collapsedNodes: doc.diagram?.collapsedNodes ?? {},
    viewport: doc.diagram?.viewport ?? { x: 0, y: 0, zoom: 1 },
  });
  if (doc.dialect === 'mysql' || doc.dialect === 'postgresql') st.setDialect(doc.dialect);
}

export function createPersistence(kv: DataKv | null, store: PersistStore): Persistence {
  let hydrated = false;
  let restored = false;
  let dirty = false;
  let applying = false;
  let writing = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedAt: number | null = null;
  let lastError: string | null = null;
  let disabled: string | null = kv ? null : 'app.data.kv is unavailable ("data" permission?)';
  let unsubscribe: (() => void) | null = null;
  let unwatch: (() => void) | null = null;

  const disable = (reason: string) => {
    disabled = reason;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flushNow = async (): Promise<boolean> => {
    if (!kv || disabled || !dirty) return false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    dirty = false;
    writing++;
    try {
      const doc = serializeDoc(store.getState());
      await kv.set(PERSIST_KEY, doc);
      lastSavedAt = doc.savedAt;
      lastError = null;
      return true;
    } catch (e) {
      dirty = true;
      lastError = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      writing--;
    }
  };

  const scheduleFlush = () => {
    if (!kv || disabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flushNow();
    }, FLUSH_DEBOUNCE_MS);
  };

  // 규칙 5 — 내구 subtree 참조 동일성만 본다(immer 구조 공유).
  const durableChanged = (s: StoreState, p: StoreState): boolean =>
    s.tables !== p.tables ||
    s.relationships !== p.relationships ||
    s.nodePositions !== p.nodePositions ||
    s.collapsedNodes !== p.collapsedNodes ||
    s.viewport !== p.viewport ||
    s.dialect !== p.dialect;

  const readDoc = async (): Promise<PersistDoc | null> => {
    const raw = await kv!.get(PERSIST_KEY);
    if (raw == null) return null;
    const doc = raw as PersistDoc;
    if (typeof doc !== 'object' || typeof doc.v !== 'number') {
      throw new Error('stored document has no version tag');
    }
    if (doc.v > PERSIST_DOC_VERSION) {
      // 규칙 6 — 더 새로운 포맷을 파괴하지 않는다.
      disable(`stored document v${doc.v} is newer than supported v${PERSIST_DOC_VERSION}`);
      return null;
    }
    return doc;
  };

  const applyStored = (doc: PersistDoc) => {
    applying = true;
    try {
      applyDoc(store, doc);
    } finally {
      applying = false;
    }
  };

  const rehydrate = async (): Promise<boolean> => {
    if (!kv || disabled) return false;
    // 규칙 7 — 미기록 로컬 편집이 있으면 로컬이 이긴다.
    if (dirty) return false;
    try {
      const doc = await readDoc();
      if (!doc) return false;
      // 자기 메아리(우리가 방금 쓴 문서) 필터 — savedAt 동일성.
      if (lastSavedAt != null && doc.savedAt === lastSavedAt) return false;
      applyStored(doc);
      lastSavedAt = doc.savedAt;
      restored = true;
      return true;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      return false;
    }
  };

  const hydrate = async (): Promise<void> => {
    if (hydrated) return;
    if (kv && !disabled) {
      try {
        const doc = await readDoc();
        if (doc) {
          applyStored(doc);
          lastSavedAt = doc.savedAt;
          restored = true;
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    hydrated = true;
    if (kv && !disabled) {
      // 규칙 3 — 구독은 hydrate 완료 후에만 설치한다.
      unsubscribe = store.subscribe((s, p) => {
        if (applying) return;
        if (!durableChanged(s, p)) return;
        dirty = true;
        scheduleFlush();
      });
      if (kv.watch) {
        unwatch = kv.watch((key) => {
          if (key !== PERSIST_KEY) return;
          if (writing > 0) return; // 자기 쓰기 브로드캐스트
          void rehydrate();
        });
      }
    }
  };

  const dispose = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (unwatch) {
      unwatch();
      unwatch = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void flushNow(); // 마지막 변경 최선노력 기록(규칙 4)
  };

  return {
    hydrate,
    rehydrate,
    flush: flushNow,
    status: () => ({
      enabled: kv != null && !disabled,
      hydrated,
      restored,
      dirty,
      pendingFlush: timer != null,
      lastSavedAt,
      lastError,
      disabled,
    }),
    dispose,
  };
}

// persist-flush / persist-status — commands.ts 의 카탈로그 규약(설명·message·envelope)과 동형.
export function registerPersistCommands(
  ctx: {
    subscriptions: Array<{ dispose(): void }>;
    app: {
      commands?: {
        register(
          name: string,
          spec: {
            description: string;
            triggers?: { ko?: string };
            message?: (data: unknown) => string;
            params?: Record<string, unknown>;
            handler: (params: unknown) => Promise<unknown>;
          },
        ): { dispose(): void };
      };
    };
  },
  persistence: Persistence,
): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  ctx.subscriptions.push(
    register('persist-flush', {
      description: 'Write the working schema to durable app storage immediately (bypasses the debounce)',
      triggers: { ko: '영속 즉시 저장 플러시 기록' },
      message: (d) => ((d as { flushed?: boolean }).flushed ? '작업 스키마를 저장했습니다' : '기록할 변경이 없습니다'),
      params: {},
      handler: async () => {
        const flushed = await persistence.flush();
        const s = persistence.status();
        if (s.disabled) return { ok: false, code: 'PERSIST_DISABLED', message: s.disabled, flushed };
        if (!flushed && s.lastError) return { ok: false, code: 'PERSIST_WRITE_FAILED', message: s.lastError, flushed };
        return { ok: true, flushed, savedAt: s.lastSavedAt };
      },
    }),
  );

  ctx.subscriptions.push(
    register('persist-status', {
      description: 'Report durable persistence state (enabled, hydrated, restored, dirty, lastSavedAt)',
      triggers: { ko: '영속 상태 확인 저장 복원' },
      message: (d) => {
        const s = d as PersistStatus;
        if (s.disabled) return `영속 저장이 비활성입니다: ${s.disabled}`;
        return `영속 저장 활성${s.restored ? ', 복원됨' : ''}${s.dirty ? ', 미기록 변경 있음' : ', 기록 완료'}`;
      },
      params: {},
      handler: async () => ({ ok: true, ...persistence.status() }),
    }),
  );
}
