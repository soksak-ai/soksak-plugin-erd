// Durable persistence for connection profiles — the THIRD durable document
// (`connections:default`), separate from the schema document (`doc:default`, persist.ts) and
// the chrome-preferences document (`prefs:default`, prefs.ts). This document holds ONLY
// non-secret connection metadata: how to reach a database (dialect, host, port, database name,
// user, environment, read-only, ssl, file). It NEVER holds a password or any other secret —
// secrets are the vault's domain (plan §3.4). connections.test.ts guards that no secret field
// ever reaches this document.
//
// The cross-window lifecycle machinery (hydrate-before-registration, debounced flush,
// version-forward guard, watch/rehydrate, self-echo filtering) is owned by durable-doc.ts;
// this module only supplies the connection document's serialize/apply/change-detection, the
// pure CRUD over the profile map, its own store slice, and the db-profile-* commands.
import { createStore, type StoreApi } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import { generateId } from '@/lib/id';
import {
  createDurableDoc,
  type DataKv,
  type DurableDoc,
  type DurableEnvelope,
  type DurableStatus,
  type DurableStore,
} from './durable-doc';

export type { DataKv } from './durable-doc';

export const CONNECTIONS_KEY = 'connections:default';
export const CONNECTIONS_DOC_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 500;

// vault 키 규약 — 비밀번호는 이 문서가 아니라 vault 의 이 키에 별도 저장된다(plan §3.4).
export function secretRefFor(profileId: string): string {
  return `connections/${profileId}/password`;
}

export type ConnectionDialect = 'sqlite' | 'mysql' | 'postgresql';
export type ConnectionEnvironment = 'dev' | 'staging' | 'prod';

// 접속 프로필 메타 — 비밀 제외. password/secret 필드는 절대 없다(vault 소관).
export interface ConnectionProfile {
  id: string;
  name: string;
  dialect: ConnectionDialect;
  environment: ConnectionEnvironment;
  readOnly: boolean;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  ssl?: boolean;
  file?: string;
}

export interface ConnectionsDoc extends DurableEnvelope {
  profiles: Record<string, ConnectionProfile>;
}

// 이 문서의 store slice — 프로필 맵과 통째 교체 setter 하나. 이 파일 안에서 정의한다(공유 store 미수정).
export interface ConnectionsState {
  connectionProfiles: Record<string, ConnectionProfile>;
  setConnectionProfiles(profiles: Record<string, ConnectionProfile>): void;
}

export type ConnectionsStore = StoreApi<ConnectionsState>;
export type ConnectionsPersistence = DurableDoc;
export type ConnectionsStatus = DurableStatus;

// connections 전용 vanilla store. 오케스트레이터가 plugin-entry 에서 생성해 주입한다.
export function createConnectionsStore(): ConnectionsStore {
  return createStore<ConnectionsState>()(
    immer((set) => ({
      connectionProfiles: {},
      setConnectionProfiles: (profiles) =>
        set((s) => {
          s.connectionProfiles = profiles;
        }),
    })),
  );
}

// ── 순수 CRUD(프로필 맵 조작, 멱등) ──────────────────────────────────────────
// 모두 새 맵을 반환하거나(변경 시) 같은 참조를 반환(무변경 시 — 불필요한 flush 억제).
export function addProfile(
  profiles: Record<string, ConnectionProfile>,
  profile: ConnectionProfile,
): Record<string, ConnectionProfile> {
  return { ...profiles, [profile.id]: profile };
}

export function removeProfile(
  profiles: Record<string, ConnectionProfile>,
  id: string,
): Record<string, ConnectionProfile> {
  if (!(id in profiles)) return profiles; // 멱등 — 없는 것 제거는 무변경
  const next = { ...profiles };
  delete next[id];
  return next;
}

export function listProfiles(profiles: Record<string, ConnectionProfile>): ConnectionProfile[] {
  return Object.values(profiles);
}

// ── serialize/apply/changed(prefs.ts 패턴) ───────────────────────────────────
export function serializeConnections(s: ConnectionsState): ConnectionsDoc {
  return {
    v: CONNECTIONS_DOC_VERSION,
    savedAt: Date.now(),
    profiles: s.connectionProfiles,
  };
}

export function applyConnections(store: DurableStore<ConnectionsState>, doc: ConnectionsDoc): void {
  store.getState().setConnectionProfiles(doc.profiles ?? {});
}

// 규칙 5 — 내구 슬라이스(프로필 맵) 참조 동일성만 본다(immer 구조 공유).
export function connectionsChanged(s: ConnectionsState, p: ConnectionsState): boolean {
  return s.connectionProfiles !== p.connectionProfiles;
}

export function createConnectionsPersistence(
  kv: DataKv | null,
  store: DurableStore<ConnectionsState>,
): ConnectionsPersistence {
  return createDurableDoc<ConnectionsDoc, ConnectionsState>(kv, store, {
    key: CONNECTIONS_KEY,
    version: CONNECTIONS_DOC_VERSION,
    debounceMs: FLUSH_DEBOUNCE_MS,
    serialize: serializeConnections,
    apply: (doc) => applyConnections(store, doc),
    changed: connectionsChanged,
  });
}

// ── 프로필 빌드(허용 필드만, 비밀 절대 없음) ─────────────────────────────────
const DIALECTS: readonly ConnectionDialect[] = ['sqlite', 'mysql', 'postgresql'];
const ENVIRONMENTS: readonly ConnectionEnvironment[] = ['dev', 'staging', 'prod'];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type BuildResult =
  | { ok: true; profile: ConnectionProfile }
  | { ok: false; code: string; message: string };

// params → ConnectionProfile. 화이트리스트만 복사한다 — password 등 임의 필드는 절대 읽지 않는다.
// 이것이 계약: 비밀은 여기로 들어올 경로 자체가 없다.
function buildProfile(p: Record<string, unknown>): BuildResult {
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) return { ok: false, code: 'INVALID_INPUT', message: 'name is required' };

  const dialect = p.dialect as ConnectionDialect;
  if (!DIALECTS.includes(dialect)) {
    return { ok: false, code: 'INVALID_INPUT', message: `dialect must be one of ${DIALECTS.join(', ')}` };
  }

  const environment = ENVIRONMENTS.includes(p.environment as ConnectionEnvironment)
    ? (p.environment as ConnectionEnvironment)
    : 'dev';

  const id = (typeof p.id === 'string' && p.id.trim()) || slugify(name) || generateId();

  const profile: ConnectionProfile = {
    id,
    name,
    dialect,
    environment,
    readOnly: p.readOnly === true,
  };
  if (typeof p.host === 'string') profile.host = p.host;
  if (typeof p.port === 'number') profile.port = p.port;
  if (typeof p.database === 'string') profile.database = p.database;
  if (typeof p.user === 'string') profile.user = p.user;
  if (typeof p.ssl === 'boolean') profile.ssl = p.ssl;
  if (typeof p.file === 'string') profile.file = p.file;

  return { ok: true, profile };
}

// ── 커맨드 카탈로그(prefs.ts 의 registerPrefsCommands 패턴) ───────────────────
// db-profile-add / db-profile-list / db-profile-remove. 배선(store·persistence 생성 + 이 호출)은
// 오케스트레이터가 plugin-entry 에서 한다.
export function registerConnectionCommands(
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
  conns: ConnectionsPersistence,
  store: ConnectionsStore,
): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  ctx.subscriptions.push(
    register('db-profile-add', {
      description:
        'Add or update a non-secret connection profile (dialect, host, port, database, user, environment, readOnly, ssl, file). Passwords are NOT accepted here — store them in the vault.',
      triggers: { ko: '접속 프로필 추가 데이터베이스 연결 등록' },
      message: (d) => {
        const r = d as { ok: boolean; message?: string; profile?: ConnectionProfile; secretRef?: string };
        if (!r.ok) return r.message ?? '프로필 추가 실패';
        return `프로필 '${r.profile?.name}' 을 추가했습니다(비밀번호는 vault 키 '${r.secretRef}' 에 별도 저장)`;
      },
      params: {
        name: { type: 'string', required: true, description: 'Human-readable profile name' },
        dialect: { type: 'string', enum: ['sqlite', 'mysql', 'postgresql'], required: true, description: 'Database dialect' },
        id: { type: 'string', description: 'Stable profile id (defaults to a slug of name)' },
        environment: { type: 'string', enum: ['dev', 'staging', 'prod'], default: 'dev', description: 'Deployment environment' },
        readOnly: { type: 'boolean', default: false, description: 'Open the connection read-only' },
        host: { type: 'string', description: 'Server host (network dialects)' },
        port: { type: 'number', description: 'Server port (network dialects)' },
        database: { type: 'string', description: 'Database name' },
        user: { type: 'string', description: 'Connection user (secret password goes to the vault, not here)' },
        ssl: { type: 'boolean', description: 'Require SSL/TLS' },
        file: { type: 'string', description: 'File path (sqlite)' },
      },
      handler: async (params) => {
        const built = buildProfile((params ?? {}) as Record<string, unknown>);
        if (!built.ok) return { ok: false, code: built.code, message: built.message };
        const st = store.getState();
        st.setConnectionProfiles(addProfile(st.connectionProfiles, built.profile));
        const flushed = await conns.flush();
        const s = conns.status();
        if (s.disabled) return { ok: false, code: 'CONNECTIONS_DISABLED', message: s.disabled };
        return {
          ok: true,
          profile: built.profile,
          secretRef: secretRefFor(built.profile.id),
          flushed,
          savedAt: s.lastSavedAt,
        };
      },
    }),
  );

  ctx.subscriptions.push(
    register('db-profile-list', {
      description: 'List all non-secret connection profiles',
      triggers: { ko: '접속 프로필 목록 조회 연결 목록' },
      message: (d) => `프로필 ${((d as { profiles?: unknown[] }).profiles ?? []).length}개`,
      params: {},
      handler: async () => ({ ok: true, profiles: listProfiles(store.getState().connectionProfiles) }),
    }),
  );

  ctx.subscriptions.push(
    register('db-profile-remove', {
      description: 'Remove a connection profile by id (idempotent — removing an absent profile succeeds)',
      triggers: { ko: '접속 프로필 삭제 제거 연결' },
      message: (d) => {
        const r = d as { ok: boolean; removed?: boolean; id?: string };
        return r.removed ? `프로필 '${r.id}' 을 삭제했습니다` : `프로필 '${r.id}' 이 없습니다(무변경)`;
      },
      params: {
        id: { type: 'string', required: true, description: 'Profile id to remove' },
      },
      handler: async (params) => {
        const id = typeof (params as { id?: unknown })?.id === 'string' ? (params as { id: string }).id : '';
        if (!id) return { ok: false, code: 'INVALID_INPUT', message: 'id is required' };
        const st = store.getState();
        const removed = id in st.connectionProfiles;
        if (removed) st.setConnectionProfiles(removeProfile(st.connectionProfiles, id));
        const flushed = await conns.flush();
        const s = conns.status();
        if (s.disabled) return { ok: false, code: 'CONNECTIONS_DISABLED', message: s.disabled };
        return { ok: true, id, removed, flushed, savedAt: s.lastSavedAt };
      },
    }),
  );
}
