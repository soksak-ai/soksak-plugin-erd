// Durable persistence for chrome preferences — panel layout & rendering choices that follow
// the user across sessions. This is a SEPARATE document (`prefs:default`) from the schema
// document (`doc:default`, persist.ts); the split is the contract. prefs holds ONLY the
// chrome-preference fields (sidebar/panel visibility & sizes, render quality, edge rendering
// options). It never holds schema, diagram positions, or dialect (those are the schema
// document's), and never theme (host-owned) or transient state (selection, dialogs,
// relationship-create mode). prefs.test.ts guards that non-chrome churn never writes here.
//
// The cross-window lifecycle machinery is shared — see durable-doc.ts.
import type { StoreState } from '@/store/index';
import type { ChromePrefsInput } from '@/store/slices/ui-slice';
import {
  createDurableDoc,
  type DataKv,
  type DurableDoc,
  type DurableEnvelope,
  type DurableStatus,
  type DurableStore,
} from './durable-doc';

export const PREFS_KEY = 'prefs:default';
export const PREFS_DOC_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 500;

// 문서 payload — 크롬 환경설정 전 필드(모두 필수, 직렬화 시 store 에서 읽는다).
export interface ChromePrefs {
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'sql' | 'mermaid' | 'console';
  showMinimap: boolean;
  showGrid: boolean;
  renderQualityLevel: 0 | 1 | 2;
  showOnlyVisibleRelatedEdges: boolean;
  showOnlySelectedRelatedEdges: boolean;
  edgeRoutingMode: 'direct' | 'ortho_short';
  notationStyle: 'crowsfoot' | 'numeric';
  edgeWorkerEnabled: boolean;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
}

export interface PrefsDoc extends DurableEnvelope {
  prefs: ChromePrefs;
}

export type PrefsPersistence = DurableDoc;
export type PrefsStatus = DurableStatus;

// 살아있는 store 상태 → 크롬 환경설정 문서.
export function serializePrefs(s: StoreState): PrefsDoc {
  return {
    v: PREFS_DOC_VERSION,
    savedAt: Date.now(),
    prefs: {
      leftSidebarOpen: s.leftSidebarOpen,
      rightSidebarOpen: s.rightSidebarOpen,
      bottomPanelOpen: s.bottomPanelOpen,
      bottomPanelTab: s.bottomPanelTab,
      showMinimap: s.showMinimap,
      showGrid: s.showGrid,
      renderQualityLevel: s.renderQualityLevel,
      showOnlyVisibleRelatedEdges: s.showOnlyVisibleRelatedEdges,
      showOnlySelectedRelatedEdges: s.showOnlySelectedRelatedEdges,
      edgeRoutingMode: s.edgeRoutingMode,
      notationStyle: s.notationStyle,
      edgeWorkerEnabled: s.edgeWorkerEnabled,
      leftWidth: s.leftWidth,
      rightWidth: s.rightWidth,
      bottomHeight: s.bottomHeight,
    },
  };
}

// 크롬 환경설정 문서 → store. 검증은 store 의 applyChromePrefs 가 값별로 수행한다.
export function applyPrefs(store: DurableStore<StoreState>, doc: PrefsDoc): void {
  const prefs = (doc.prefs ?? {}) as ChromePrefsInput;
  store.getState().applyChromePrefs(prefs);
}

// 크롬 환경설정 필드의 값 변경만 본다(모두 스칼라라 값 비교).
function prefsChanged(s: StoreState, p: StoreState): boolean {
  return (
    s.leftSidebarOpen !== p.leftSidebarOpen ||
    s.rightSidebarOpen !== p.rightSidebarOpen ||
    s.bottomPanelOpen !== p.bottomPanelOpen ||
    s.bottomPanelTab !== p.bottomPanelTab ||
    s.showMinimap !== p.showMinimap ||
    s.showGrid !== p.showGrid ||
    s.renderQualityLevel !== p.renderQualityLevel ||
    s.showOnlyVisibleRelatedEdges !== p.showOnlyVisibleRelatedEdges ||
    s.showOnlySelectedRelatedEdges !== p.showOnlySelectedRelatedEdges ||
    s.edgeRoutingMode !== p.edgeRoutingMode ||
    s.notationStyle !== p.notationStyle ||
    s.edgeWorkerEnabled !== p.edgeWorkerEnabled ||
    s.leftWidth !== p.leftWidth ||
    s.rightWidth !== p.rightWidth ||
    s.bottomHeight !== p.bottomHeight
  );
}

export function createPrefsPersistence(kv: DataKv | null, store: DurableStore<StoreState>): PrefsPersistence {
  return createDurableDoc<PrefsDoc, StoreState>(kv, store, {
    key: PREFS_KEY,
    version: PREFS_DOC_VERSION,
    debounceMs: FLUSH_DEBOUNCE_MS,
    serialize: serializePrefs,
    apply: (doc) => applyPrefs(store, doc),
    changed: prefsChanged,
  });
}

// prefs-flush / prefs-status — persist 커맨드와 동형(설명·message·envelope).
export function registerPrefsCommands(
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
  prefs: PrefsPersistence,
  store: DurableStore<StoreState>,
): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  ctx.subscriptions.push(
    register('prefs-flush', {
      description: 'Write chrome preferences (panel layout, render options) to durable app storage immediately',
      triggers: { ko: '환경설정 즉시 저장 플러시 패널' },
      message: (d) => ((d as { flushed?: boolean }).flushed ? '환경설정을 저장했습니다' : '기록할 변경이 없습니다'),
      params: {},
      handler: async () => {
        const flushed = await prefs.flush();
        const s = prefs.status();
        if (s.disabled) return { ok: false, code: 'PREFS_DISABLED', message: s.disabled, flushed };
        if (!flushed && s.lastError) return { ok: false, code: 'PREFS_WRITE_FAILED', message: s.lastError, flushed };
        return { ok: true, flushed, savedAt: s.lastSavedAt };
      },
    }),
  );

  ctx.subscriptions.push(
    register('prefs-status', {
      description: 'Report chrome-preference persistence state (enabled, hydrated, restored, dirty, lastSavedAt)',
      triggers: { ko: '환경설정 상태 확인 저장 복원 패널' },
      message: (d) => {
        const s = d as PrefsStatus;
        if (s.disabled) return `환경설정 저장이 비활성입니다: ${s.disabled}`;
        return `환경설정 저장 활성${s.restored ? ', 복원됨' : ''}${s.dirty ? ', 미기록 변경 있음' : ', 기록 완료'}`;
      },
      params: {},
      // 상태면 노출(R7) — 크롬 환경설정에는 별도 getter 가 없다. 지속성 상태와 함께 현재 라이브
      // 값(values)을 읽을 수 있게 보고한다. 헤드리스 복원 검증과 AI 뷰 제어의 단일 읽기 지점.
      handler: async () => ({ ok: true, ...prefs.status(), values: serializePrefs(store.getState()).prefs }),
    }),
  );
}
