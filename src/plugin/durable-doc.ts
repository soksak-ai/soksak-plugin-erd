// Reusable cross-window durable-document engine — the machinery behind every kv-backed
// document the plugin restores (schema doc:default, chrome prefs:default). A document is a
// version-tagged JSON blob under one kv key; the engine owns hydrate/flush/watch/version-guard
// and delegates exactly three document-specific concerns to a spec:
//   - serialize(state): read the live store → a stamped doc ({ v, savedAt, ...payload })
//   - apply(doc): write a stored doc back into the store via existing atomic actions
//   - changed(next, prev): is the durable slice of the store different between two states?
//
// Invariants (shared by all documents; enforced through each doc's own *.test.ts):
// 1. One document, version-tagged, under `spec.key` in the plugin's own kv namespace.
// 2. Storage is the host `app.data.kv` surface. Absent → persistence disabled, store stays
//    fully functional; status() reports why.
// 3. Lifecycle: hydrate BEFORE command registration (headless callers never observe
//    pre-restore state); the store subscriber is installed only AFTER hydrate resolves
//    (hydration must not persist itself; an empty boot must not clobber a stored document).
//    hydrate never throws — failure degrades and is reported via status().
// 4. Writes are debounced (trailing, spec.debounceMs) and serialized from the live store at
//    flush time. flush() forces a write (E2E determinism); dispose() fires a best-effort
//    final flush. The loss window is at most one debounce interval.
// 5. Change detection is spec.changed on the durable slice only. Unrelated churn never flushes.
// 6. A stored document NEWER than this build is never applied and never overwritten:
//    persistence disables itself instead of destroying forward data.
// 7. Cross-window: kv.watch rehydrates this window on foreign writes unless it has unflushed
//    local edits (local edits win). Self echoes are filtered by savedAt identity.

// 호스트 app.data.kv 표면 중 durable doc 가 쓰는 부분(ns 는 호스트가 주입).
export interface DataKv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  watch?(cb: (key: string) => void): () => void;
}

// zustand store 표면 중 엔진이 쓰는 최소 계약(react/vanilla 공통).
export interface DurableStore<State> {
  getState(): State;
  subscribe(listener: (state: State, prev: State) => void): () => void;
}

// 모든 durable doc 의 공통 봉투 — 버전 태그와 저장 시각(자기 메아리 필터용).
export interface DurableEnvelope {
  v: number;
  savedAt: number;
}

// 문서별로 달라지는 세 가지 관심사만 주입한다.
export interface DurableSpec<Doc extends DurableEnvelope, State> {
  key: string;
  version: number;
  debounceMs: number;
  serialize(state: State): Doc; // v·savedAt 을 스탬프한다
  apply(doc: Doc): void; // 기존 원자 액션만 사용해 store 에 적용
  changed(next: State, prev: State): boolean; // 내구 슬라이스 변경 여부
}

export interface DurableStatus {
  enabled: boolean;
  hydrated: boolean;
  restored: boolean;
  dirty: boolean;
  pendingFlush: boolean;
  lastSavedAt: number | null;
  lastError: string | null;
  disabled: string | null;
}

export interface DurableDoc {
  hydrate(): Promise<void>;
  rehydrate(): Promise<boolean>;
  flush(): Promise<boolean>;
  status(): DurableStatus;
  dispose(): void;
}

export function createDurableDoc<Doc extends DurableEnvelope, State>(
  kv: DataKv | null,
  store: DurableStore<State>,
  spec: DurableSpec<Doc, State>,
): DurableDoc {
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
      const doc = spec.serialize(store.getState());
      await kv.set(spec.key, doc);
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
    }, spec.debounceMs);
  };

  const readDoc = async (): Promise<Doc | null> => {
    const raw = await kv!.get(spec.key);
    if (raw == null) return null;
    const doc = raw as Doc;
    if (typeof doc !== 'object' || typeof doc.v !== 'number') {
      throw new Error('stored document has no version tag');
    }
    if (doc.v > spec.version) {
      // 규칙 6 — 더 새로운 포맷을 파괴하지 않는다.
      disable(`stored document v${doc.v} is newer than supported v${spec.version}`);
      return null;
    }
    return doc;
  };

  const applyStored = (doc: Doc) => {
    applying = true;
    try {
      spec.apply(doc);
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
        if (!spec.changed(s, p)) return;
        dirty = true;
        scheduleFlush();
      });
      if (kv.watch) {
        unwatch = kv.watch((key) => {
          if (key !== spec.key) return;
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
