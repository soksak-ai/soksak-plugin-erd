// 영속/복원 계약 테스트 — persist.ts 머리주석의 규칙 1~7을 그대로 단언한다.
// DOM/React/Pixi import 금지(commands.test.ts 와 동일 헤드리스 규율).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { createSchemaSlice } from '@/store/slices/schema-slice';
import { createDiagramSlice } from '@/store/slices/diagram-slice';
import { createUISlice } from '@/store/slices/ui-slice';
import { createMigrationSlice } from '@/store/slices/migration-slice';
import type { StoreState } from '@/store/index';
import { registerCommands } from './commands';
import {
  createPersistence,
  registerPersistCommands,
  PERSIST_KEY,
  PERSIST_DOC_VERSION,
  type DataKv,
} from './persist';

setAutoFreeze(false);

// commands.test.ts 와 동일한 실제 4-슬라이스 합성 store.
function makeStore() {
  return createStore<StoreState>()(
    immer((...a) => ({
      ...createSchemaSlice(...a),
      ...createDiagramSlice(...a),
      ...createUISlice(...a),
      ...createMigrationSlice(...a),
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

// ── 공유 kv 저장소 모킹 ──────────────────────────────────────────────────────
// 호스트 data.kv 의 JSON round-trip(비-JSON 손실)과 전 창 broadcast(자기 자신 포함)를 흉내낸다.
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

// 플러그인 활성화의 헤드리스 등가물(plugin-entry 순서 그대로):
// hydrate → registerCommands → registerPersistCommands.
async function bootRuntime(kv: DataKv | null) {
  const store = makeStore();
  const { ctx, handlers, specs } = makeCtx();
  const persistence = createPersistence(kv, store as any);
  await persistence.hydrate();
  registerCommands(ctx as any, store as any);
  registerPersistCommands(ctx as any, persistence);
  const call = (name: string, params: any = {}) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`command not registered: ${name}`);
    return h(params);
  };
  return { store, ctx, handlers, specs, call, persistence };
}

const USERS_OPS = {
  name: 'users',
  columns: [
    { name: 'id', dataType: 'INT', isPrimaryKey: true, autoIncrement: true },
    { name: 'email', dataType: 'VARCHAR(255)', isUnique: true },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('영속 복원 계약', () => {
  it('런타임 재적재 후 스키마·좌표·뷰포트가 복원된다(결함 재현→계약)', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const created = await a.call('create-table', USERS_OPS);
    expect(created.ok).toBe(true);
    const moved = await a.call('set-position', { table: 'users', x: 120, y: 80 });
    expect(moved.ok).toBe(true);
    await a.call('set-viewport', { x: 33, y: -10, zoom: 1.5 });
    const flushed = await a.call('persist-flush');
    expect(flushed.ok).toBe(true);
    expect(flushed.flushed).toBe(true);
    expect(rows.has(PERSIST_KEY)).toBe(true);

    // 완전히 새 store/ctx — 같은 kv 만 공유(= 런타임 재적재/앱 재시작).
    const b = await bootRuntime(kv);
    const schema = await b.call('get-schema', { mode: 'compact' });
    expect(schema.tables.map((t: any) => t.name)).toContain('users');
    const sb = b.store.getState();
    const usersId = Object.values(sb.tables).find((t: any) => t.name === 'users')!.id;
    expect(sb.nodePositions[usersId]).toEqual({ x: 120, y: 80 });
    expect(sb.viewport).toEqual({ x: 33, y: -10, zoom: 1.5 });
    expect(b.persistence.status().restored).toBe(true);
    expect(b.persistence.status().enabled).toBe(true);
  });

  it('빈 저장소로 부팅하면 복원 없음·불필요한 쓰기 없음(규칙 3)', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    expect(a.persistence.status().hydrated).toBe(true);
    expect(a.persistence.status().restored).toBe(false);
    // hydrate 자체가 저장을 만들면 안 된다.
    expect(rows.size).toBe(0);
    const st = await a.call('persist-status');
    expect(st.ok).toBe(true);
    expect(st.dirty).toBe(false);
  });

  it('변경은 디바운스 후 자동 기록된다(규칙 4)', async () => {
    vi.useFakeTimers();
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    await a.call('create-table', USERS_OPS);
    expect(a.persistence.status().dirty).toBe(true);
    expect(a.persistence.status().pendingFlush).toBe(true);
    expect(rows.size).toBe(0); // 아직 디바운스 중
    await vi.advanceTimersByTimeAsync(600);
    expect(rows.has(PERSIST_KEY)).toBe(true);
    expect(a.persistence.status().dirty).toBe(false);
  });

  it('선택 변경은 기록을 유발하지 않는다(규칙 5)', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    await a.call('create-table', USERS_OPS);
    await a.call('persist-flush');
    const before = rows.get(PERSIST_KEY);
    await a.call('select', { tables: ['users'] });
    expect(a.persistence.status().dirty).toBe(false);
    expect(rows.get(PERSIST_KEY)).toBe(before);
  });

  it('손상된 문서는 빈 스키마로 강등되고 이후 편집은 정상 기록된다(규칙 3)', async () => {
    const { rows, kv } = makeMemKv();
    rows.set(PERSIST_KEY, '{broken');
    const a = await bootRuntime(kv);
    expect(a.persistence.status().restored).toBe(false);
    expect(a.persistence.status().lastError).toBeTruthy();
    const r = await a.call('create-table', USERS_OPS);
    expect(r.ok).toBe(true);
    const f = await a.call('persist-flush');
    expect(f.ok).toBe(true);
    expect(JSON.parse(rows.get(PERSIST_KEY)!).schema.tables).toBeTruthy();
  });

  it('더 새로운 버전의 문서는 적용도 덮어쓰기도 하지 않는다(규칙 6)', async () => {
    const { rows, kv } = makeMemKv();
    const future = JSON.stringify({ v: PERSIST_DOC_VERSION + 1, savedAt: 1, schema: {}, diagram: {}, dialect: 'mysql' });
    rows.set(PERSIST_KEY, future);
    const a = await bootRuntime(kv);
    expect(a.persistence.status().disabled).toBeTruthy();
    await a.call('create-table', USERS_OPS);
    const f = await a.call('persist-flush');
    expect(f.ok).toBe(false);
    expect(f.code).toBe('PERSIST_DISABLED');
    expect(rows.get(PERSIST_KEY)).toBe(future); // 문서 보존
  });

  it('저장 표면이 없으면 비활성으로 부팅하고 커맨드는 정상 동작한다(규칙 2)', async () => {
    const a = await bootRuntime(null);
    expect(a.persistence.status().enabled).toBe(false);
    expect(a.persistence.status().disabled).toBeTruthy();
    const r = await a.call('create-table', USERS_OPS);
    expect(r.ok).toBe(true);
    const f = await a.call('persist-flush');
    expect(f.ok).toBe(false);
    expect(f.code).toBe('PERSIST_DISABLED');
  });
});

describe('영속 복원 계약 — 교차 창(규칙 7)', () => {
  it('다른 창의 기록은 이 창을 재수화한다(로컬 미기록 편집이 없을 때)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const b = await bootRuntime(kv);
    await a.call('create-table', USERS_OPS);
    await a.call('persist-flush'); // broadcast → b 재수화(비동기)
    await new Promise((r) => setTimeout(r, 0));
    const schema = await b.call('get-schema', { mode: 'compact' });
    expect(schema.tables.map((t: any) => t.name)).toContain('users');
  });

  it('로컬 미기록 편집이 있으면 외부 기록을 덮어쓰지 않는다(로컬 우선)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const b = await bootRuntime(kv);
    await b.call('create-table', { name: 'local_edit', columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true }] });
    expect(b.persistence.status().dirty).toBe(true);
    await a.call('create-table', USERS_OPS);
    await a.call('persist-flush');
    await new Promise((r) => setTimeout(r, 0));
    const sb = b.store.getState();
    expect(Object.values(sb.tables).map((t: any) => t.name)).toContain('local_edit');
    expect(Object.values(sb.tables).map((t: any) => t.name)).not.toContain('users');
  });
});

describe('persist 커맨드 카탈로그 규약', () => {
  it('persist-flush / persist-status 는 description 과 message 를 갖는다', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    for (const name of ['persist-flush', 'persist-status']) {
      const spec = a.specs.get(name);
      expect(spec, `missing command: ${name}`).toBeTruthy();
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
      expect(typeof spec.message).toBe('function');
    }
  });
});
