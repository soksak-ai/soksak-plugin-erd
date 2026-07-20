// 접속 프로필 영속 계약 테스트 — connections.ts 머리주석의 규칙을 그대로 단언한다.
// 핵심: connections:default 문서는 비밀(password 등)을 절대 담지 않는다(vault 소관, plan §3.4).
// 왕복(add→serialize→apply→list)이 성립하고, 저장된 문서 어디에도 secret 필드가 없다.
// DOM/React/Pixi import 금지(헤드리스 규율).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { setAutoFreeze } from 'immer';
import {
  createConnectionsStore,
  createConnectionsPersistence,
  registerConnectionCommands,
  serializeConnections,
  applyConnections,
  connectionsChanged,
  addProfile,
  removeProfile,
  listProfiles,
  secretRefFor,
  CONNECTIONS_KEY,
  CONNECTIONS_DOC_VERSION,
  type ConnectionProfile,
} from './connections';
import type { DataKv } from './durable-doc';

setAutoFreeze(false);

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

// prefs.test.ts 와 동일한 공유 kv 모킹(JSON round-trip + 전 창 broadcast).
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

// 플러그인 활성화의 헤드리스 등가물: hydrate → registerConnectionCommands.
async function bootRuntime(kv: DataKv | null) {
  const store = createConnectionsStore();
  const { ctx, handlers, specs } = makeCtx();
  const conns = createConnectionsPersistence(kv, store as any);
  await conns.hydrate();
  registerConnectionCommands(ctx as any, conns, store);
  const call = (name: string, params: any = {}) => {
    const h = handlers.get(name);
    if (!h) throw new Error(`command not registered: ${name}`);
    return h(params);
  };
  return { store, ctx, handlers, specs, call, conns };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('순수 CRUD — 멱등', () => {
  const p = (id: string): ConnectionProfile => ({ id, name: id, dialect: 'sqlite', environment: 'dev', readOnly: false });

  it('addProfile 은 새 맵을 반환하고 id 로 덮어쓴다', () => {
    const a = addProfile({}, p('one'));
    expect(Object.keys(a)).toEqual(['one']);
    const b = addProfile(a, { ...p('one'), name: 'renamed' });
    expect(Object.keys(b)).toEqual(['one']);
    expect(b.one.name).toBe('renamed');
  });

  it('removeProfile 은 없는 것 제거 시 같은 참조를 반환한다(무변경)', () => {
    const a = addProfile({}, p('one'));
    const same = removeProfile(a, 'absent');
    expect(same).toBe(a); // 참조 동일 → 불필요한 flush 억제
    const gone = removeProfile(a, 'one');
    expect(gone).not.toBe(a);
    expect(Object.keys(gone)).toEqual([]);
  });

  it('listProfiles 는 값 배열을 반환한다', () => {
    const a = addProfile(addProfile({}, p('one')), p('two'));
    expect(listProfiles(a).map((x) => x.id).sort()).toEqual(['one', 'two']);
  });
});

describe('접속 프로필 영속 계약 — 왕복', () => {
  it('add → serialize → apply → list 왕복이 성립한다(런타임 재적재 후 복원)', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);

    const added = await a.call('db-profile-add', {
      name: 'Prod DB',
      dialect: 'postgresql',
      host: 'db.internal',
      port: 5432,
      database: 'app',
      user: 'reader',
      environment: 'prod',
      readOnly: true,
      ssl: true,
    });
    expect(added.ok).toBe(true);
    expect(added.flushed).toBe(true);
    expect(rows.has(CONNECTIONS_KEY)).toBe(true);
    const id = added.profile.id;
    expect(id).toBe('prod-db'); // name 슬러그

    // 완전히 새 store — 같은 kv 만 공유(= 앱 재시작).
    const b = await bootRuntime(kv);
    expect(b.conns.status().restored).toBe(true);
    const list = await b.call('db-profile-list');
    expect(list.ok).toBe(true);
    expect(list.profiles).toHaveLength(1);
    const restored = list.profiles[0];
    expect(restored.id).toBe('prod-db');
    expect(restored.name).toBe('Prod DB');
    expect(restored.dialect).toBe('postgresql');
    expect(restored.host).toBe('db.internal');
    expect(restored.port).toBe(5432);
    expect(restored.environment).toBe('prod');
    expect(restored.readOnly).toBe(true);
    expect(restored.ssl).toBe(true);
  });

  it('serialize/apply 를 직접 왕복해도 프로필이 보존된다', () => {
    const src = createConnectionsStore();
    src.getState().setConnectionProfiles(
      addProfile({}, { id: 'x', name: 'X', dialect: 'mysql', environment: 'staging', readOnly: false, host: 'h', port: 3306 }),
    );
    const doc = serializeConnections(src.getState());
    expect(doc.v).toBe(CONNECTIONS_DOC_VERSION);

    const dst = createConnectionsStore();
    applyConnections(dst as any, doc);
    expect(listProfiles(dst.getState().connectionProfiles)).toHaveLength(1);
    expect(dst.getState().connectionProfiles.x.host).toBe('h');
    // serialize 는 store 의 프로필 맵 참조를 그대로 넘기므로 apply 후 두 store 는 동일 참조 → 무변경.
    expect(connectionsChanged(src.getState(), dst.getState())).toBe(false);
  });
});

describe('비밀 배제 계약(plan §3.4) — password 는 이 문서에 절대 없다', () => {
  it('db-profile-add 는 password 파라미터를 무시하고 저장된 문서 어디에도 secret 이 없다', async () => {
    const { rows, kv } = makeMemKv();
    const a = await bootRuntime(kv);
    const added = await a.call('db-profile-add', {
      name: 'Leaky',
      dialect: 'mysql',
      host: 'h',
      user: 'u',
      // 침투 시도: 비밀 필드들 — 절대 반영되면 안 된다.
      password: 'super-secret',
      secret: 'nope',
      token: 'nope',
    } as any);
    expect(added.ok).toBe(true);

    // 반환 프로필에 비밀 없음.
    expect(added.profile.password).toBeUndefined();
    expect('secret' in added.profile).toBe(false);

    // vault 키 안내(hint)만 제공한다.
    expect(added.secretRef).toBe(secretRefFor(added.profile.id));

    // 저장된 raw JSON 문자열 전체에 비밀 값이 없다(직렬화 경로 전수).
    const raw = rows.get(CONNECTIONS_KEY)!;
    expect(raw).not.toContain('super-secret');
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('token');

    const parsed = JSON.parse(raw);
    for (const prof of Object.values(parsed.profiles) as any[]) {
      expect('password' in prof).toBe(false);
      expect('secret' in prof).toBe(false);
      expect('token' in prof).toBe(false);
    }
  });
});

describe('db-profile-remove — 멱등', () => {
  it('존재 프로필은 삭제, 없는 프로필 삭제도 ok:true(removed:false)', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    await a.call('db-profile-add', { name: 'Temp', dialect: 'sqlite', file: '/tmp/t.db' });

    const r1 = await a.call('db-profile-remove', { id: 'temp' });
    expect(r1.ok).toBe(true);
    expect(r1.removed).toBe(true);
    expect((await a.call('db-profile-list')).profiles).toHaveLength(0);

    const r2 = await a.call('db-profile-remove', { id: 'temp' });
    expect(r2.ok).toBe(true);
    expect(r2.removed).toBe(false); // 멱등
  });
});

describe('입력 검증 · 저장 표면 부재', () => {
  it('name 누락 / 잘못된 dialect 는 INVALID_INPUT', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    expect((await a.call('db-profile-add', { dialect: 'sqlite' })).code).toBe('INVALID_INPUT');
    expect((await a.call('db-profile-add', { name: 'X', dialect: 'oracle' } as any)).code).toBe('INVALID_INPUT');
  });

  it('저장 표면이 없으면 비활성으로 부팅하고 store 는 정상 동작한다', async () => {
    const a = await bootRuntime(null);
    expect(a.conns.status().enabled).toBe(false);
    expect(a.conns.status().disabled).toBeTruthy();
    const r = await a.call('db-profile-add', { name: 'X', dialect: 'sqlite' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('CONNECTIONS_DISABLED');
    // 그래도 인메모리 store 에는 반영된다(persistence 만 비활성).
    expect(listProfiles(a.store.getState().connectionProfiles)).toHaveLength(1);
  });
});

describe('커맨드 카탈로그 규약', () => {
  it('db-profile-add/list/remove 는 description 과 message 를 갖는다', async () => {
    const { kv } = makeMemKv();
    const a = await bootRuntime(kv);
    for (const name of ['db-profile-add', 'db-profile-list', 'db-profile-remove']) {
      const spec = a.specs.get(name);
      expect(spec, `missing command: ${name}`).toBeTruthy();
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
      expect(typeof spec.message).toBe('function');
    }
  });
});
