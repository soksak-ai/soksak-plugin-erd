// Durable persistence for the working schema — the plugin's restore contract.
//
// Rules (enforced by src/plugin/persist.test.ts — do not weaken):
// 1. One durable document, version-tagged, under kv key `doc:default` in the plugin's own
//    namespace. It holds exactly: schema (tables, relationships), diagram (nodePositions,
//    collapsedNodes, viewport), dialect. Selection, dialogs, theme, and the migration slice
//    are session state and never persist; .mig files remain the migration channel.
// 2. Storage is reached ONLY through the KvPort boundary. Two adapters exist because the
//    host is mid-transition between plugin runtimes:
//      - 'data': the in-window `app.data.kv` surface (host-injected ns, requires the
//        "data" permission; provides watch → cross-window rehydrate).
//      - 'exec': the registry commands `data.kv.*` via `app.commands.execute` (the native
//        runtime's only storage path; explicit ns; no event bridge yet, so no watch).
//    Detection order: `app.data.kv` when present, else `app.commands.execute`, else
//    persistence is disabled (the plugin stays fully functional, memory-only).
//    Remove the 'data' adapter when the in-window plugin API is retired.
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
//    UNKNOWN_COMMAND on the exec path (core without data.kv.*) also disables persistence.
// 7. Cross-window ('data' adapter only): foreign writes rehydrate this window unless it
//    has unflushed local edits (local edits win; last writer wins at the store). Self
//    echoes are filtered by savedAt identity. Without watch ('exec' adapter) concurrent
//    windows are last-writer-wins only — documented limitation until the runtime event
//    bridge lands.
import type { StoreState } from '@/store/index';
import type { Table, Relationship, SQLDialect } from '@/types/schema';
import type { NodePosition, Viewport } from '@/types/diagram';

export const PERSIST_KEY = 'doc:default';
export const PERSIST_DOC_VERSION = 1;
const PERSIST_NS = 'soksak-plugin-erd';
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

// 저장 경계 — persistence 는 이 포트 밖의 호스트 표면을 모른다.
export interface KvPort {
  backend: 'data' | 'exec';
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
  backend: 'data' | 'exec' | 'none';
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

// 호스트 app 표면에서 사용 가능한 저장 어댑터를 고른다(규칙 2의 탐지 순서).
export function selectKvPort(app: unknown): KvPort | null {
  const a = app as {
    data?: { kv?: { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void>; watch?(cb: (k: string) => void): () => void } };
    commands?: { execute?(command: string, params?: Record<string, unknown>): Promise<{ ok: boolean; code?: string; message?: string; data?: { value?: unknown } }> };
  } | null;
  const kv = a?.data?.kv;
  if (kv && typeof kv.get === 'function' && typeof kv.set === 'function') {
    return {
      backend: 'data',
      get: (key) => kv.get(key),
      set: (key, value) => kv.set(key, value),
      watch: typeof kv.watch === 'function' ? (cb) => kv.watch!(cb) : undefined,
    };
  }
  const exec = a?.commands?.execute;
  if (typeof exec === 'function') {
    const call = exec.bind(a!.commands);
    return {
      backend: 'exec',
      get: async (key) => {
        const r = await call('data.kv.get', { ns: PERSIST_NS, key });
        if (!r?.ok) throw new KvCommandError('data.kv.get', r?.code, r?.message);
        return r.data?.value ?? null;
      },
      set: async (key, value) => {
        const r = await call('data.kv.set', { ns: PERSIST_NS, key, value });
        if (!r?.ok) throw new KvCommandError('data.kv.set', r?.code, r?.message);
      },
    };
  }
  return null;
}

class KvCommandError extends Error {
  code: string;
  constructor(command: string, code: string | undefined, message: string | undefined) {
    super(`${command} failed: ${code ?? 'NO_RESPONSE'}${message ? ` — ${message}` : ''}`);
    this.code = code ?? 'NO_RESPONSE';
  }
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

export function createPersistence(port: KvPort | null, store: PersistStore): Persistence {
  let hydrated = false;
  let restored = false;
  let dirty = false;
  let applying = false;
  let writing = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedAt: number | null = null;
  let lastError: string | null = null;
  let disabled: string | null = port ? null : 'no storage surface on this host';
  let unsubscribe: (() => void) | null = null;
  let unwatch: (() => void) | null = null;

  const disable = (reason: string) => {
    disabled = reason;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const recordError = (e: unknown) => {
    lastError = e instanceof Error ? e.message : String(e);
    // UNKNOWN_COMMAND = 이 코어에 data.kv.* 가 없다(영구 조건) → 재시도 폭풍 대신 비활성.
    if (e instanceof KvCommandError && e.code === 'UNKNOWN_COMMAND') {
      disable('data.kv.* commands are not available on this core');
    }
  };

  const flushNow = async (): Promise<boolean> => {
    if (!port || disabled || !dirty) return false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    dirty = false;
    writing++;
    try {
      const doc = serializeDoc(store.getState());
      await port.set(PERSIST_KEY, doc);
      lastSavedAt = doc.savedAt;
      lastError = null;
      return true;
    } catch (e) {
      dirty = true;
      recordError(e);
      return false;
    } finally {
      writing--;
    }
  };

  const scheduleFlush = () => {
    if (!port || disabled) return;
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
    const raw = await port!.get(PERSIST_KEY);
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
    if (!port || disabled) return false;
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
      recordError(e);
      return false;
    }
  };

  const hydrate = async (): Promise<void> => {
    if (hydrated) return;
    if (port && !disabled) {
      try {
        const doc = await readDoc();
        if (doc) {
          applyStored(doc);
          lastSavedAt = doc.savedAt;
          restored = true;
        }
      } catch (e) {
        recordError(e);
      }
    }
    hydrated = true;
    if (port && !disabled) {
      // 규칙 3 — 구독은 hydrate 완료 후에만 설치한다.
      unsubscribe = store.subscribe((s, p) => {
        if (applying) return;
        if (!durableChanged(s, p)) return;
        dirty = true;
        scheduleFlush();
      });
      if (port.watch) {
        unwatch = port.watch((key) => {
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
      backend: disabled && !port ? 'none' : (port?.backend ?? 'none'),
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
      description: 'Report durable persistence state (backend, hydrated, restored, dirty, lastSavedAt)',
      triggers: { ko: '영속 상태 확인 저장 백엔드 복원' },
      message: (d) => {
        const s = d as PersistStatus;
        if (s.disabled) return `영속 저장이 비활성입니다: ${s.disabled}`;
        return `backend=${s.backend}${s.restored ? ', 복원됨' : ''}${s.dirty ? ', 미기록 변경 있음' : ', 기록 완료'}`;
      },
      params: {},
      handler: async () => ({ ok: true, ...persistence.status() }),
    }),
  );
}
