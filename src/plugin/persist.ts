// Durable persistence for the working schema — the plugin's restore contract.
//
// This document (`doc:default`) holds EXACTLY: schema (tables, relationships), diagram
// (nodePositions, collapsedNodes, viewport), dialect. Selection, dialogs, theme, chrome
// preferences, and the migration slice are NOT stored here — chrome preferences live in a
// separate `prefs:default` document (see prefs.ts); .mig files remain the migration channel.
// This exclusion is the contract: widening it silently is forbidden (persist.test.ts guards
// the six durable subtrees; prefs.test.ts guards that prefs never bleed into this document).
//
// The cross-window lifecycle machinery (hydrate-before-registration, debounced flush,
// version-forward guard, watch/rehydrate, self-echo filtering) is owned by durable-doc.ts;
// this module only supplies the schema document's serialize/apply/change-detection.
import type { StoreState } from '@/store/index';
import type { Table, Relationship, SQLDialect } from '@/types/schema';
import type { NodePosition, Viewport } from '@/types/diagram';
import {
  createDurableDoc,
  type DataKv,
  type DurableDoc,
  type DurableEnvelope,
  type DurableStatus,
  type DurableStore,
} from './durable-doc';

export type { DataKv } from './durable-doc';

export const PERSIST_KEY = 'doc:default';
export const PERSIST_DOC_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 500;

export interface PersistDoc extends DurableEnvelope {
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

// 하위호환 별칭 — 이전 공개 타입 이름을 유지한다.
export type PersistStore = DurableStore<StoreState>;
export type PersistStatus = DurableStatus;
export type Persistence = DurableDoc;

// 살아있는 store 상태 → 내구 문서(여섯 subtree만).
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

// 규칙 5 — 내구 subtree 참조 동일성만 본다(immer 구조 공유).
function durableChanged(s: StoreState, p: StoreState): boolean {
  return (
    s.tables !== p.tables ||
    s.relationships !== p.relationships ||
    s.nodePositions !== p.nodePositions ||
    s.collapsedNodes !== p.collapsedNodes ||
    s.viewport !== p.viewport ||
    s.dialect !== p.dialect
  );
}

export function createPersistence(kv: DataKv | null, store: PersistStore): Persistence {
  return createDurableDoc<PersistDoc, StoreState>(kv, store, {
    key: PERSIST_KEY,
    version: PERSIST_DOC_VERSION,
    debounceMs: FLUSH_DEBOUNCE_MS,
    serialize: serializeDoc,
    apply: (doc) => applyDoc(store, doc),
    changed: durableChanged,
  });
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
