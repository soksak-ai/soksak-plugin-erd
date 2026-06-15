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
import { diffSchemas } from '@/features/migration/diff';
import { serializeMig, parseMig } from '@/features/migration/mig-dsl';
import { applyOperation } from '@/features/migration/operations';
import type { ERDSchema } from '@/types/schema';

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

// ── 인메모리 fs 모킹(파일 기반 마이그레이션 테스트용) ─────────────────────────
// soksak fs API(readText/writeText/list) 표면을 그대로 흉내낸다. 단일 디렉토리 평면 저장.
function makeMemFs() {
  const files = new Map<string, string>(); // 절대경로 → 내용
  const base = (path: string) => path.slice(path.lastIndexOf('/') + 1);
  const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/'));
  return {
    files,
    fs: {
      readText: async (path: string) => {
        // soksak 런타임(Tauri)은 누락 파일을 Error 가 아닌 "문자열"로 reject 한다 → 충실히 흉내.
        if (!files.has(path)) throw `read_text_file: no such file: ${path}`;
        const text = files.get(path)!;
        return { text, truncated: false, totalBytes: text.length };
      },
      writeText: async (path: string, content: string) => {
        files.set(path, content);
      },
      list: async (dir: string) => {
        const norm = dir.endsWith('/') ? dir.slice(0, -1) : dir;
        const children = [...files.keys()]
          .filter((p) => dirOf(p) === norm)
          .map((p) => ({ name: base(p), dir: false }));
        return { root: norm, children };
      },
    },
  };
}

// fs 주입 버전 setup. fs=null 이면 fs 없는(권한 미부여) ctx.
function setupFs(memFs: ReturnType<typeof makeMemFs> | null) {
  const store = makeStore();
  const { ctx, handlers, specs } = makeCtx();
  if (memFs) (ctx.app as any).fs = memFs.fs;
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
      // Migration(파일 기반 .mig)
      'migration-status', 'migration-generate', 'migration-list', 'migration-show',
      'migration-sql', 'migration-apply', 'migration-revert', 'migration-lint',
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

describe('Import/Export — 라운드트립(엔진 배선)', () => {
  // users(PK id) ← orders(user_id FK) 2-테이블 스키마를 커맨드로 구축.
  // export 한 텍스트가 비어있지 않고, replace 재적재 후 테이블 이름 집합이 동치임을 단언한다.
  async function buildSchema(call: (n: string, p?: any) => Promise<any>) {
    await call('create-table', { name: 'users', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false, autoIncrement: true },
      { name: 'email', dataType: 'VARCHAR', length: 255, nullable: false },
    ] });
    await call('create-table', { name: 'orders', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false, autoIncrement: true },
    ] });
    await call('add-relationship', { source: 'users', target: 'orders', type: '1:N', autoFk: true });
  }

  const tableNames = async (call: (n: string, p?: any) => Promise<any>) => {
    const list = await call('list-tables');
    return list.tables.map((t: any) => t.name).sort();
  };

  it('export-sql(각 dialect) 비어있지 않음 → import-sql(replace) 재적재 → 테이블 이름 동치', async () => {
    for (const dialect of ['sqlite', 'mysql', 'postgresql'] as const) {
      const { call } = setup();
      await buildSchema(call);
      const before = await tableNames(call);

      const exp = await call('export-sql', { dialect });
      expect(exp.ok, `export-sql ${dialect}`).toBe(true);
      expect(typeof exp.sql).toBe('string');
      expect(exp.sql.length).toBeGreaterThan(0);

      const imp = await call('import-sql', { text: exp.sql, dialect, mode: 'replace' });
      expect(imp.ok, `import-sql ${dialect}: ${imp.error}`).toBe(true);
      expect(imp.added.tables).toBeGreaterThan(0);

      const after = await tableNames(call);
      expect(after, `roundtrip table names ${dialect}`).toEqual(before);
    }
  });

  it('export-dbml → import-dbml(replace) 라운드트립', async () => {
    const { call } = setup();
    await buildSchema(call);
    const before = await tableNames(call);

    const exp = await call('export-dbml');
    expect(exp.ok).toBe(true);
    expect(exp.dbml.length).toBeGreaterThan(0);

    const imp = await call('import-dbml', { text: exp.dbml, mode: 'replace' });
    expect(imp.ok, `import-dbml: ${imp.error}`).toBe(true);

    const after = await tableNames(call);
    expect(after).toEqual(before);
  });

  it('export-prisma → import-prisma(replace) 라운드트립', async () => {
    const { call } = setup();
    await buildSchema(call);
    const before = await tableNames(call);

    const exp = await call('export-prisma');
    expect(exp.ok).toBe(true);
    expect(exp.prisma.length).toBeGreaterThan(0);

    const imp = await call('import-prisma', { text: exp.prisma, mode: 'replace' });
    expect(imp.ok, `import-prisma: ${imp.error}`).toBe(true);

    const after = await tableNames(call);
    expect(after).toEqual(before);
  });

  it('export-mermaid → import-mermaid(replace) 라운드트립', async () => {
    const { call } = setup();
    await buildSchema(call);
    const before = await tableNames(call);

    const exp = await call('export-mermaid');
    expect(exp.ok).toBe(true);
    expect(exp.mermaid.length).toBeGreaterThan(0);

    const imp = await call('import-mermaid', { text: exp.mermaid, mode: 'replace' });
    expect(imp.ok, `import-mermaid: ${imp.error}`).toBe(true);

    const after = await tableNames(call);
    expect(after).toEqual(before);
  });

  it('import 실패 텍스트는 {ok:false,error}', async () => {
    const { call } = setup();
    const res = await call('import-sql', { text: '', dialect: 'mysql' });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

// ── 마이그레이션 순수부분: diff → serialize → parse → fold 동치 ──────────────────
describe('Migration 순수 라운드트립 — diffSchemas → serializeMig → parseMig → fold 동치', () => {
  function schemaOf(tables: any[]): ERDSchema {
    return {
      tables: Object.fromEntries(tables.map((t) => [t.id, t])),
      relationships: {},
      layers: {},
    };
  }
  const col = (id: string, name: string, dataType = 'INT', extra: any = {}) => ({
    id, name, dataType,
    nullable: extra.nullable ?? true,
    autoIncrement: extra.autoIncrement ?? false,
    isPrimaryKey: extra.isPrimaryKey ?? false,
    isUnique: extra.isUnique ?? false,
    defaultValue: extra.defaultValue,
  });
  const tbl = (id: string, name: string, columns: any[]) => ({ id, name, columns, indexes: [] });

  // 동치 비교용 정규형(id 무시 — 이름/구조만).
  const normalize = (s: ERDSchema) =>
    Object.values(s.tables)
      .map((t) => ({
        name: t.name,
        columns: [...t.columns]
          .map((c) => ({ name: c.name, dataType: c.dataType, nullable: c.nullable, isPrimaryKey: c.isPrimaryKey }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  it('빈 스키마 → 2테이블: diff 를 .mig 직렬화/역파싱 후 빈 스키마에 fold 하면 동치', () => {
    const empty: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    const after = schemaOf([
      tbl('t1', 'users', [col('c1', 'id', 'INT', { isPrimaryKey: true, nullable: false }), col('c2', 'email', 'VARCHAR')]),
      tbl('t2', 'posts', [col('c3', 'id', 'INT', { isPrimaryKey: true, nullable: false })]),
    ]);

    // diff → ops
    const ops = diffSchemas(empty, after);
    expect(ops.length).toBeGreaterThan(0);

    // ops → .mig 텍스트 → 재파싱(up)
    const mig = serializeMig(ops);
    const { ops: parsed } = parseMig(mig);

    // 빈 스키마에 parsed up 을 fold → after 와 동치
    let folded: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    for (const op of parsed) folded = applyOperation(folded, op);
    expect(normalize(folded)).toEqual(normalize(after));
  });

  it('down 블록 자동 파생: serializeMig 가 up/down 둘 다 산출하고 down 으로 원복', () => {
    const empty: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    const after = schemaOf([tbl('t1', 'widget', [col('c1', 'id', 'INT', { isPrimaryKey: true, nullable: false })])]);
    const ops = diffSchemas(empty, after);
    const mig = serializeMig(ops);
    expect(mig).toContain('up {');
    expect(mig).toContain('down {');

    const { ops: up, downOps } = parseMig(mig);
    expect(downOps.length).toBeGreaterThan(0);

    // up fold → 테이블 존재, 이어서 down fold → 다시 비어짐
    let s: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    for (const op of up) s = applyOperation(s, op);
    expect(Object.values(s.tables).map((t) => t.name)).toContain('widget');
    for (const op of downOps) s = applyOperation(s, op);
    expect(Object.values(s.tables).map((t) => t.name)).not.toContain('widget');
  });
});

// ── 파일 기반 마이그레이션 커맨드(인메모리 fs 모킹) ───────────────────────────
describe('Migration 커맨드 — 파일 기반(.mig) 배선', () => {
  const DIR = '/proj/migrations';

  it('fs 권한 미부여 시 write/read 계열은 {ok:false,error}', async () => {
    const { call } = setupFs(null); // fs 없음
    for (const name of ['migration-status', 'migration-generate', 'migration-list', 'migration-apply', 'migration-revert']) {
      const res = await call(name, { dir: DIR });
      expect(res.ok, name).toBe(false);
      expect(res.error).toBe('fs 권한 필요');
    }
    // migration-show/sql 도 동일
    const show = await call('migration-show', { dir: DIR, id: 'x.mig' });
    expect(show.ok).toBe(false);
  });

  it('migration-generate: confirm 없으면 preview, confirm=true 면 파일 기록', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);

    // working store 에 테이블 구성
    await call('create-table', { name: 'users', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false, autoIncrement: true },
    ] });

    // 미리보기 — 파일 미기록
    const prev = await call('migration-generate', { dir: DIR, name: 'init' });
    expect(prev.ok).toBe(true);
    expect(prev.preview).toBe(true);
    expect(typeof prev.mig).toBe('string');
    expect(prev.mig).toContain('-- name: init');
    expect(prev.mig).toContain('create table users');
    expect(mem.files.size).toBe(0); // 기록 안 됨

    // confirm — 파일 기록
    const written = await call('migration-generate', { dir: DIR, name: 'init', confirm: true });
    expect(written.ok).toBe(true);
    expect(written.written).toBe(true);
    expect(written.filename).toMatch(/^migration_\d{8}_\d{6}_001\.mig$/);
    expect(mem.files.size).toBe(1);
  });

  it('migration-generate: 변경 0 이면 noop', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);
    // 빈 store + 빈 dir → diff 없음
    const res = await call('migration-generate', { dir: DIR, confirm: true });
    expect(res.ok).toBe(true);
    expect(res.noop).toBe(true);
    expect(mem.files.size).toBe(0);
  });

  it('status → generate(confirm) → list → show → apply 일관성', async () => {
    const mem = makeMemFs();
    const { store, call } = setupFs(mem);

    await call('create-table', { name: 'product', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false },
      { name: 'price', dataType: 'DECIMAL' },
    ] });

    // status: 베이스라인(빈) vs 현재 → pending > 0
    const st = await call('migration-status', { dir: DIR });
    expect(st.ok).toBe(true);
    expect(st.applied).toBe(0);
    expect(st.pendingOps).toBeGreaterThan(0);
    expect(st.clean).toBe(false);

    // generate confirm
    const gen = await call('migration-generate', { dir: DIR, name: 'add-product', confirm: true });
    expect(gen.ok).toBe(true);
    const filename = gen.filename;

    // list
    const list = await call('migration-list', { dir: DIR });
    expect(list.ok).toBe(true);
    expect(list.files).toContain(filename);
    expect(list.count).toBe(1);

    // show: name 메타 + ops 파싱
    const show = await call('migration-show', { dir: DIR, id: filename });
    expect(show.ok).toBe(true);
    expect(show.name).toBe('add-product');
    expect(show.ops.length).toBeGreaterThan(0);

    // generate 후 status 는 다시 clean(베이스라인이 현재를 따라잡음)
    const st2 = await call('migration-status', { dir: DIR });
    expect(st2.ok).toBe(true);
    expect(st2.applied).toBe(1);
    expect(st2.clean).toBe(true);

    // store 를 비운 뒤 apply 로 베이스라인 복원
    store.getState().clearSchema();
    expect(Object.keys(store.getState().tables).length).toBe(0);
    const applied = await call('migration-apply', { dir: DIR });
    expect(applied.ok).toBe(true);
    const names = Object.values(store.getState().tables).map((t: any) => t.name);
    expect(names).toContain('product');
  });

  it('migration-apply(id) 후 migration-revert(id) 로 원복', async () => {
    const mem = makeMemFs();
    const { store, call } = setupFs(mem);

    await call('create-table', { name: 'temp_t', columns: [{ name: 'id', dataType: 'INT' }] });
    const gen = await call('migration-generate', { dir: DIR, name: 'mk-temp', confirm: true });
    const id = gen.filename;

    // store 비우고 단일 파일 apply → temp_t 복원
    store.getState().clearSchema();
    await call('migration-apply', { dir: DIR, id });
    expect(Object.values(store.getState().tables).map((t: any) => t.name)).toContain('temp_t');

    // revert(down) → temp_t 제거
    const rev = await call('migration-revert', { dir: DIR, id });
    expect(rev.ok).toBe(true);
    expect(Object.values(store.getState().tables).map((t: any) => t.name)).not.toContain('temp_t');
  });

  it('migration-sql: .mig up ops → mysql/postgresql DDL', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);
    await call('create-table', { name: 'acct', columns: [{ name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false }] });
    const gen = await call('migration-generate', { dir: DIR, confirm: true });
    const id = gen.filename;

    const mysql = await call('migration-sql', { dir: DIR, id, dialect: 'mysql' });
    expect(mysql.ok).toBe(true);
    expect(mysql.up).toContain('CREATE TABLE');

    const pg = await call('migration-sql', { dir: DIR, id, dialect: 'postgresql' });
    expect(pg.ok).toBe(true);
    expect(pg.up.length).toBeGreaterThan(0);
  });

  it('migration-sql: 확장자 없는 id(postgresql) 도 해석해 ALTER DDL 반환(버그 B 회귀)', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);
    await call('create-table', { name: 'acct', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false },
    ] });
    const gen = await call('migration-generate', { dir: DIR, confirm: true });
    const filename: string = gen.filename;
    const stem = filename.replace(/\.mig$/, ''); // .mig 제거한 형태(소켓이 넘긴 id)

    const pg = await call('migration-sql', { dir: DIR, id: stem, dialect: 'postgresql' });
    expect(pg.ok, pg.error).toBe(true);
    expect(pg.id).toBe(filename); // 실제 파일명으로 해석됨
    expect(typeof pg.up).toBe('string');
    expect(pg.up).toContain('CREATE TABLE');
  });

  it('migration-show: 없는 id 는 throw 가 아니라 {ok:false,error}(undefined 메시지 금지)', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);
    const res = await call('migration-show', { dir: DIR, id: 'ghost' });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(res.error).not.toContain('undefined');
  });

  it('FK(autoFk) 스키마: generate(confirm) 후 status 가 clean(반전 spurious FK 없음 — 소켓 E2E 시나리오)', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);

    // users(PK id) ← orders(FK). autoFk: source=users(PK), target=orders(FK보유).
    await call('create-table', { name: 'users', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false, autoIncrement: true },
    ] });
    await call('create-table', { name: 'orders', columns: [
      { name: 'id', dataType: 'INT', isPrimaryKey: true, nullable: false, autoIncrement: true },
    ] });
    await call('add-relationship', { source: 'users', target: 'orders', type: '1:N', autoFk: true });

    // 1차 generate(init): FK 포함
    const gen1 = await call('migration-generate', { dir: DIR, name: 'init', confirm: true });
    expect(gen1.ok).toBe(true);
    // .mig 가 FK 를 FK 보유 테이블(orders)에 건다.
    const initText = [...mem.files.values()][0];
    expect(initText).toMatch(/add fk \S+ on orders \( \S+ \) -> users \( id \)/);

    // 1차 후 status: 반전 버그면 spurious add/drop fk 로 clean=false
    const st = await call('migration-status', { dir: DIR });
    expect(st.ok).toBe(true);
    expect(st.clean, JSON.stringify(st.ops)).toBe(true);

    // 컬럼 하나 추가 후 2차 generate up 에 spurious FK 2줄이 없어야 한다
    await call('add-column', { table: 'orders', name: 'note', dataType: 'VARCHAR' });
    const gen2 = await call('migration-generate', { dir: DIR, name: 'add-note', confirm: true });
    expect(gen2.ok).toBe(true);
    const fkOps = (gen2.ops as any[]).filter((o) => o.type === 'addForeignKey' || o.type === 'dropForeignKey');
    expect(fkOps, JSON.stringify(gen2.ops)).toEqual([]);
  });

  it('migration-lint: 정상/오류 텍스트(fs 불요)', async () => {
    const { call } = setupFs(null); // fs 없어도 lint 는 동작
    const good = await call('migration-lint', { text: 'up {\n  create table t ( id INT; );\n}' });
    expect(good.ok).toBe(true);
    expect(good.valid).toBe(true);
    expect(good.errors).toEqual([]);

    const bad = await call('migration-lint', { text: 'up {\n  create table' });
    expect(bad.ok).toBe(true);
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('write 계열은 dir 누락 시 {ok:false,error}', async () => {
    const mem = makeMemFs();
    const { call } = setupFs(mem);
    const res = await call('migration-generate', {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain('dir');
  });

  it('params 4번째 인자(소켓 거부 방지): 전 migration 커맨드가 params 스펙을 갖는다', () => {
    const { specs } = setupFs(makeMemFs());
    for (const name of [
      'migration-status', 'migration-generate', 'migration-list', 'migration-show',
      'migration-sql', 'migration-apply', 'migration-revert', 'migration-lint',
    ]) {
      const spec = specs.get(name);
      expect(spec, name).toBeTruthy();
      expect(spec.params, `${name} params`).toBeTruthy();
      expect(Object.keys(spec.params).length).toBeGreaterThan(0);
    }
  });
});
