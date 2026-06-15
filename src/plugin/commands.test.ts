// 헤드리스 커맨드 카탈로그 단위테스트 — DOM/React/Pixi import 금지.
// vanilla zustand store(실제 슬라이스 재사용)로 mutation/introspection/batch/layout 을 단언한다.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { createSchemaSlice } from '@/store/slices/schema-slice';
import { createDiagramSlice } from '@/store/slices/diagram-slice';
import { createUISlice } from '@/store/slices/ui-slice';
import { createMigrationSlice } from '@/store/slices/migration-slice';
import type { StoreState } from '@/store/index';
import { registerCommands } from './commands';
import { resolveTable } from './resolve';

setAutoFreeze(false);

// 실제 슬라이스를 그대로 합성한 헤드리스 store. 앱의 React store 와 동일한 mutation 표면.
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

// soksak ctx 모킹 — register 호출을 잡아 이름→핸들러 맵으로 노출.
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
      },
    },
  };
  return { ctx, handlers, specs };
}

// 등록된 store 와 ctx 를 한 번에 만든다.
function setup() {
  const store = makeStore();
  const { ctx, handlers, specs } = makeCtx();
  registerCommands(ctx as any, store as any);
  const call = (name: string, params: any = {}) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`command not registered: ${name}`);
    return h(params);
  };
  return { store, ctx, handlers, specs, call };
}

describe('registerCommands — 카탈로그 등록', () => {
  it('전 그룹의 핵심 커맨드가 등록된다(description 포함)', () => {
    const { handlers, specs } = setup();
    const expected = [
      // Introspection
      'get-schema', 'list-tables', 'get-table', 'get-columns', 'list-relationships', 'validate', 'stats', 'diff',
      // Mutation
      'create-table', 'rename-table', 'drop-table', 'add-column', 'update-column', 'drop-column',
      'reorder-columns', 'set-pk', 'set-unique', 'add-index', 'drop-index',
      'add-relationship', 'update-relationship', 'drop-relationship', 'set-color',
      // Batch
      'apply', 'undo', 'redo',
      // Layout
      'auto-layout', 'set-position', 'get-viewport', 'set-viewport', 'select',
    ];
    for (const name of expected) {
      expect(handlers.has(name), `missing command: ${name}`).toBe(true);
      expect(typeof specs.get(name).description).toBe('string');
      expect(specs.get(name).description.length).toBeGreaterThan(0);
    }
    // ping 은 plugin-entry 소관 — 카탈로그에서 제외.
    expect(handlers.has('ping')).toBe(false);
  });
});

describe('Mutation ↔ Introspection 동치', () => {
  it('create-table 후 get-schema/list-tables 에 반영된다', async () => {
    const { call } = setup();
    const created = await call('create-table', { name: 'users' });
    expect(created.ok).toBe(true);
    expect(created.id).toBeTruthy();

    const list = await call('list-tables');
    expect(list.ok).toBe(true);
    expect(list.tables.map((t: any) => t.name)).toContain('users');

    const schema = await call('get-schema', { mode: 'full' });
    expect(schema.ok).toBe(true);
    expect(Object.values(schema.schema.tables).some((t: any) => t.name === 'users')).toBe(true);

    // compact 모드는 컬럼 요약만(헤드리스 토큰 절약).
    const compact = await call('get-schema', { mode: 'compact' });
    expect(compact.ok).toBe(true);
    const u = compact.tables.find((t: any) => t.name === 'users');
    expect(u).toBeTruthy();
    expect(Array.isArray(u.columns)).toBe(true);
  });

  it('create-table 는 ifNotExists 로 멱등이다', async () => {
    const { call } = setup();
    const a = await call('create-table', { name: 'orders' });
    const b = await call('create-table', { name: 'orders', ifNotExists: true });
    expect(b.ok).toBe(true);
    expect(b.id).toBe(a.id);
    expect(b.noop).toBe(true);
    // ifNotExists 없으면 동명 충돌은 에러.
    const c = await call('create-table', { name: 'orders' });
    expect(c.ok).toBe(false);
    expect(c.error).toBeTruthy();
  });

  it('이름 기반 주소지정: rename/add-column/drop-table 가 이름으로 동작한다', async () => {
    const { call } = setup();
    await call('create-table', { name: 'products' });
    const r = await call('rename-table', { table: 'products', name: 'items' });
    expect(r.ok).toBe(true);

    const ac = await call('add-column', { table: 'items', name: 'price', dataType: 'DECIMAL' });
    expect(ac.ok).toBe(true);
    const cols = await call('get-columns', { table: 'items' });
    expect(cols.columns.map((c: any) => c.name)).toContain('price');

    const d = await call('drop-table', { table: 'items' });
    expect(d.ok).toBe(true);
    const list = await call('list-tables');
    expect(list.tables.map((t: any) => t.name)).not.toContain('items');
  });

  it('add-column ifNotExists 멱등 / drop-column 없는 컬럼 noop', async () => {
    const { call } = setup();
    await call('create-table', { name: 't1' });
    await call('add-column', { table: 't1', name: 'a' });
    const dup = await call('add-column', { table: 't1', name: 'a', ifNotExists: true });
    expect(dup.ok).toBe(true);
    expect(dup.noop).toBe(true);

    const noop = await call('drop-column', { table: 't1', column: 'nonexistent', ifExists: true });
    expect(noop.ok).toBe(true);
    expect(noop.noop).toBe(true);
  });
});

describe('resolveTable — 이름 해석', () => {
  it('이름과 id 모두로 찾는다', async () => {
    const { store, call } = setup();
    const created = await call('create-table', { name: 'customer' });
    const byName = resolveTable(store as any, 'customer');
    expect(byName.ok).toBe(true);
    expect(byName.ok && byName.id).toBe(created.id);
    const byId = resolveTable(store as any, created.id);
    expect(byId.ok).toBe(true);
    expect(byId.ok && byId.id).toBe(created.id);
  });

  it('오타 시 did_you_mean 근접 후보를 제시한다', async () => {
    const { store, call } = setup();
    await call('create-table', { name: 'customer' });
    await call('create-table', { name: 'category' });
    const res = resolveTable(store as any, 'custmer');
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.did_you_mean).toContain('customer');
  });

  it('동명 모호 시 candidates 를 반환한다', async () => {
    const { store } = setup();
    // 같은 이름의 테이블 둘을 직접 주입(헤드리스 store mutation).
    store.getState().addTable({ name: 'dup' });
    store.getState().addTable({ name: 'dup' });
    const res = resolveTable(store as any, 'dup');
    expect(res.ok).toBe(false);
    expect(res.ok === false && Array.isArray(res.candidates)).toBe(true);
    expect(res.ok === false && res.candidates!.length).toBe(2);
  });
});

describe('add-relationship — autoFk 규약', () => {
  it('source=참조PK·target=FK보유, autoFk 시 FK 컬럼을 생성한다', async () => {
    const { store, call } = setup();
    // users(PK id) ← orders(user_id FK)
    await call('create-table', { name: 'users' });
    await call('create-table', { name: 'orders' });

    const rel = await call('add-relationship', {
      source: 'users',
      target: 'orders',
      type: '1:N',
      autoFk: true,
    });
    expect(rel.ok).toBe(true);
    expect(rel.id).toBeTruthy();

    // orders 에 FK 컬럼이 생성됐다.
    const cols = await call('get-columns', { table: 'orders' });
    const fk = cols.columns.find((c: any) => /user/i.test(c.name));
    expect(fk).toBeTruthy();

    // 관계가 introspection 에 노출되고 source/target 테이블 id 가 맞다.
    const rels = await call('list-relationships');
    expect(rels.ok).toBe(true);
    const found = rels.relationships.find((r: any) => r.id === rel.id);
    expect(found).toBeTruthy();

    const usersId = resolveTable(store as any, 'users');
    const ordersId = resolveTable(store as any, 'orders');
    expect(usersId.ok && ordersId.ok).toBe(true);
    if (usersId.ok && ordersId.ok) {
      expect(found.sourceTableId).toBe(usersId.id);
      expect(found.targetTableId).toBe(ordersId.id);
    }
  });
});

describe('Batch apply — atomic 스냅샷/복원', () => {
  it('성공 배치는 모든 op 를 반영한다', async () => {
    const { call } = setup();
    const res = await call('apply', {
      title: 'init',
      atomic: true,
      ops: [
        { command: 'create-table', params: { name: 'a' } },
        { command: 'create-table', params: { name: 'b' } },
        { command: 'add-column', params: { table: 'a', name: 'x' } },
      ],
    });
    expect(res.ok).toBe(true);
    const list = await call('list-tables');
    expect(list.tables.map((t: any) => t.name).sort()).toEqual(['a', 'b']);
  });

  it('atomic 배치 중 부분 실패 시 전체 복원(롤백)된다', async () => {
    const { call } = setup();
    await call('create-table', { name: 'keep' });

    const res = await call('apply', {
      title: 'broken',
      atomic: true,
      ops: [
        { command: 'create-table', params: { name: 'tmp1' } },
        { command: 'rename-table', params: { table: 'does-not-exist', name: 'z' } }, // 실패 지점
        { command: 'create-table', params: { name: 'tmp2' } },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();

    // 롤백: tmp1/tmp2 둘 다 없고 keep 만 남는다.
    const list = await call('list-tables');
    const names = list.tables.map((t: any) => t.name);
    expect(names).toContain('keep');
    expect(names).not.toContain('tmp1');
    expect(names).not.toContain('tmp2');
  });

  it('atomic:false 는 실패 이후도 계속 진행하고 결과를 보고한다', async () => {
    const { call } = setup();
    const res = await call('apply', {
      title: 'best-effort',
      atomic: false,
      ops: [
        { command: 'create-table', params: { name: 'ok1' } },
        { command: 'rename-table', params: { table: 'ghost', name: 'z' } },
        { command: 'create-table', params: { name: 'ok2' } },
      ],
    });
    expect(res.ok).toBe(false); // 하나라도 실패하면 ok=false
    const list = await call('list-tables');
    const names = list.tables.map((t: any) => t.name);
    expect(names).toContain('ok1');
    expect(names).toContain('ok2');
  });
});

describe('Layout — auto-layout / position / viewport / select', () => {
  beforeEach(() => {});

  it('auto-layout 가 모든 테이블의 좌표를 채운다', async () => {
    const { store, call } = setup();
    await call('create-table', { name: 'a' });
    await call('create-table', { name: 'b' });
    const res = await call('auto-layout');
    expect(res.ok).toBe(true);
    const positions = store.getState().nodePositions;
    expect(Object.keys(positions).length).toBe(2);
  });

  it('set-position 은 이름으로 좌표를 설정한다', async () => {
    const { store, call } = setup();
    await call('create-table', { name: 'a' });
    const res = await call('set-position', { table: 'a', x: 100, y: 200 });
    expect(res.ok).toBe(true);
    const id = resolveTable(store as any, 'a');
    expect(id.ok).toBe(true);
    if (id.ok) {
      expect(store.getState().nodePositions[id.id]).toEqual({ x: 100, y: 200 });
    }
  });

  it('get/set-viewport 라운드트립', async () => {
    const { call } = setup();
    const set = await call('set-viewport', { x: 10, y: 20, zoom: 1.5 });
    expect(set.ok).toBe(true);
    const get = await call('get-viewport');
    expect(get.ok).toBe(true);
    expect(get.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it('select 는 이름 배열을 id 선택으로 변환한다', async () => {
    const { store, call } = setup();
    await call('create-table', { name: 'a' });
    await call('create-table', { name: 'b' });
    const res = await call('select', { tables: ['a', 'b'] });
    expect(res.ok).toBe(true);
    expect(store.getState().selectedNodeIds.length).toBe(2);
  });
});

describe('Introspection — validate / stats / diff', () => {
  it('validate 는 이슈 배열을 반환한다', async () => {
    const { call } = setup();
    await call('create-table', { name: 'a' });
    const res = await call('validate');
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.issues)).toBe(true);
  });

  it('stats 는 테이블/컬럼/관계 수를 센다', async () => {
    const { call } = setup();
    await call('create-table', { name: 'a' });
    await call('create-table', { name: 'b' });
    const res = await call('stats');
    expect(res.ok).toBe(true);
    expect(res.stats.tableCount).toBe(2);
    expect(typeof res.stats.columnCount).toBe('number');
    expect(typeof res.stats.relationshipCount).toBe('number');
  });

  it('diff 는 두 스냅샷 간 added/removed 를 보고한다', async () => {
    const { call } = setup();
    const before = await call('get-schema', { mode: 'full' });
    await call('create-table', { name: 'newbie' });
    const res = await call('diff', { from: before.schema });
    expect(res.ok).toBe(true);
    expect(res.diff.addedTables).toContain('newbie');
  });
});
