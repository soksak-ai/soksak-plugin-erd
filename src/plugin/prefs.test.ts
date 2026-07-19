// Chrome-preferences 영속 계약 테스트 — prefs.ts 머리주석의 규칙을 그대로 단언한다.
// 핵심: prefs:default 문서는 스키마 문서(doc:default)와 완전히 분리된다. 스키마/선택/방언/테마
// 변경은 prefs 를 절대 기록하지 않는다(계약 격리). DOM/React/Pixi import 금지(헤드리스 규율).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { createSchemaSlice } from '@/store/slices/schema-slice';
import { createDiagramSlice } from '@/store/slices/diagram-slice';
import { createUISlice } from '@/store/slices/ui-slice';
import type { StoreState } from '@/store/index';
import {
  createPrefsPersistence,
  registerPrefsCommands,
  PREFS_KEY,
  PREFS_DOC_VERSION,
} from './prefs';
import { PERSIST_KEY } from './persist';
import type { DataKv } from './durable-doc';

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

type Handler = (params: any) => Promise<any>;

function makeCtx() {
  const handlers = new Map<string, Handler>();
  const specs = new Map<string, any>();
  const ctx = {
    subscriptions: [] as any[],
    app: {
      commands: {
        register(name: string, spec: { description: string; params?: any; handler: Handler }) {
          handlers.set(name, spec.handler);
          specs.set(name, spec);
          return { dispose() {} };
        },
      } as any,
    } as any,
  };
  return { ctx, handlers, specs };
}

// persist.test.ts 와 동일한 공유 kv 모킹(JSON round-trip + 전 창 broadcast).
function makeMemKv() {
  const rows = new Map<string, string>();
  const watchers = new Set<(key: string) => void>();
  const kv: DataKv = {
    get: async (key) => (rows.has(key) ? JSON.parse(rows.get(key)!) : null),
    set: async (key, value) => {
      rows.set(key, JSON.stringify(value));
      for (const cb of [...watchers]) cb(key);
    },
    watch: (cb) => {
      watchers.add(cb);
      return () => watchers.delete(cb);
    },
  };
  return { rows, kv };
}

// 플러그인 활성화의 헤드리스 등가물: hydrate → registerPrefsCommands.
async function bootRuntime(kv: DataKv | null) {
  const store = makeStore();
  const { ctx, handlers, specs } = makeCtx();
  const prefs = createPrefsPersistence(kv, store as any);
  await prefs.hydrate();
  registerPrefsCommands(ctx as any, prefs, store as any);
  const call = (name: string, params: any = {}) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`command not registered: ${name}`);
    return h(params);
  };
  return { store, ctx, handlers, specs, call, prefs };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('chrome-prefs 영속 계약', () => {
  it('런타임 재적재 후 크롬 환경설정이 복원된다(결함 재현→계약)', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const s = a.store.getState();
    // 기본값과 다른 값으로 크롬 상태를 바꾼다.
    s.toggleLeftSidebar();          // true → false
    s.setBottomPanelTab('mermaid'); // sql → mermaid
    s.setRenderQualityLevel(2);     // 1 → 2
    s.toggleMinimap();              // true → false
    s.setEdgeRoutingMode('ortho_short');
    s.setNotationStyle('numeric'); // crowsfoot → numeric
    s.setPanelSizes({ leftWidth: 300, rightWidth: 360, bottomHeight: 200 });

    const flushed = await a.call('prefs-flush');
    expect(flushed.ok).toBe(true);
    expect(flushed.flushed).toBe(true);
    expect(rows.has(PREFS_KEY)).toBe(true);

    // 완전히 새 store — 같은 kv 만 공유(= 앱 재시작).
    const b = await bootRuntime(kv);
    const sb = b.store.getState();
    expect(sb.leftSidebarOpen).toBe(false);
    expect(sb.bottomPanelTab).toBe('mermaid');
    expect(sb.renderQualityLevel).toBe(2);
    expect(sb.showMinimap).toBe(false);
    expect(sb.edgeRoutingMode).toBe('ortho_short');
    expect(sb.notationStyle).toBe('numeric');
    expect(sb.leftWidth).toBe(300);
    expect(sb.rightWidth).toBe(360);
    expect(sb.bottomHeight).toBe(200);
    expect(b.prefs.status().restored).toBe(true);
    expect(b.prefs.status().enabled).toBe(true);

    // 상태면 노출(R7) — prefs-status 는 복원된 라이브 값을 그대로 읽을 수 있게 보고한다.
    const st = await b.call('prefs-status');
    expect(st.values.bottomPanelTab).toBe('mermaid');
    expect(st.values.renderQualityLevel).toBe(2);
    expect(st.values.leftSidebarOpen).toBe(false);
    expect(st.values.leftWidth).toBe(300);
    expect(st.values.notationStyle).toBe('numeric');
  });

  it('prefs-status 는 현재 크롬 값을 읽을 수 있는 상태면으로 노출한다(R7)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const before = await a.call('prefs-status');
    expect(before.values.showGrid).toBe(true); // 기본값
    a.store.getState().toggleGrid();
    const after = await a.call('prefs-status');
    expect(after.values.showGrid).toBe(false); // 라이브 반영
  });

  it('prefs 문서는 스키마 문서와 격리된다 — prefs-flush 는 doc:default 를 만들지 않는다', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    a.store.getState().toggleGrid();
    await a.call('prefs-flush');
    expect(rows.has(PREFS_KEY)).toBe(true);
    expect(rows.has(PERSIST_KEY)).toBe(false); // 스키마 문서는 prefs 소관이 아니다
  });

  it('스키마·방언·테마·선택 변경은 prefs 를 기록하지 않는다(계약 격리)', async () => {
    vi.useFakeTimers();
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const s = a.store.getState();
    s.addTable({ name: 'users' });            // 스키마(doc:default 소관)
    s.setDialect('postgresql');               // 방언(doc:default 소관)
    s.setTheme('light');                      // 테마(호스트 소관)
    s.setRelationshipCreateMode('1:N');       // 일시 상태
    await vi.advanceTimersByTimeAsync(1000);
    expect(a.prefs.status().dirty).toBe(false);
    expect(rows.has(PREFS_KEY)).toBe(false);
  });

  it('크롬 변경은 디바운스 후 자동 기록된다', async () => {
    vi.useFakeTimers();
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    a.store.getState().toggleBottomPanel();
    expect(a.prefs.status().dirty).toBe(true);
    expect(a.prefs.status().pendingFlush).toBe(true);
    expect(rows.size).toBe(0);
    await vi.advanceTimersByTimeAsync(600);
    expect(rows.has(PREFS_KEY)).toBe(true);
    expect(a.prefs.status().dirty).toBe(false);
  });

  it('빈 저장소로 부팅하면 복원 없음·불필요한 쓰기 없음', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    expect(a.prefs.status().hydrated).toBe(true);
    expect(a.prefs.status().restored).toBe(false);
    expect(rows.size).toBe(0);
    const st = await a.call('prefs-status');
    expect(st.ok).toBe(true);
    expect(st.dirty).toBe(false);
  });

  it('더 새로운 버전의 문서는 적용도 덮어쓰기도 하지 않는다', async () => {
    const { rows, kv } = makeMemKv();
    const future = JSON.stringify({ v: PREFS_DOC_VERSION + 1, savedAt: 1, prefs: { leftSidebarOpen: false } });
    rows.set(PREFS_KEY, future);
    const a = await bootRuntime(kv);
    expect(a.prefs.status().disabled).toBeTruthy();
    // 미래 문서가 적용되지 않았다 → 기본값 유지.
    expect(a.store.getState().leftSidebarOpen).toBe(true);
    a.store.getState().toggleGrid();
    const f = await a.call('prefs-flush');
    expect(f.ok).toBe(false);
    expect(f.code).toBe('PREFS_DISABLED');
    expect(rows.get(PREFS_KEY)).toBe(future); // 문서 보존
  });

  it('저장 표면이 없으면 비활성으로 부팅하고 스토어는 정상 동작한다', async () => {
    const a = await bootRuntime(null);
    expect(a.prefs.status().enabled).toBe(false);
    expect(a.prefs.status().disabled).toBeTruthy();
    a.store.getState().toggleGrid(); // 여전히 동작
    const f = await a.call('prefs-flush');
    expect(f.ok).toBe(false);
    expect(f.code).toBe('PREFS_DISABLED');
  });
});

describe('chrome-prefs 영속 계약 — 교차 창', () => {
  it('다른 창의 기록은 이 창을 재수화한다(로컬 미기록 편집이 없을 때)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const b = await bootRuntime(kv);
    a.store.getState().setRenderQualityLevel(0);
    await a.call('prefs-flush');
    await new Promise((r) => setTimeout(r, 0));
    expect(b.store.getState().renderQualityLevel).toBe(0);
  });

  it('로컬 미기록 편집이 있으면 외부 기록을 덮어쓰지 않는다(로컬 우선)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const b = await bootRuntime(kv);
    b.store.getState().setBottomPanelTab('console'); // b 로컬 미기록
    expect(b.prefs.status().dirty).toBe(true);
    a.store.getState().setBottomPanelTab('mermaid');
    await a.call('prefs-flush');
    await new Promise((r) => setTimeout(r, 0));
    expect(b.store.getState().bottomPanelTab).toBe('console'); // 로컬이 이긴다
  });
});

describe('prefs 커맨드 카탈로그 규약', () => {
  it('prefs-flush / prefs-status 는 description 과 message 를 갖는다', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    for (const name of ['prefs-flush', 'prefs-status']) {
      const spec = a.specs.get(name);
      expect(spec, `missing command: ${name}`).toBeTruthy();
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
      expect(typeof spec.message).toBe('function');
    }
  });
});
