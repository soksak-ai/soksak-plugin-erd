// View → core command bridge (plan §6). The React view runs inside the plugin's Shadow
// DOM and has no direct handle on the core; `activate(ctx)` owns `ctx.app`. This module
// threads `app.commands.execute` (bound in plugin-entry) and the connections store into the
// tree via one context, plus the ephemeral DB-session state (selected profile + per-profile
// connection status) the panels share.
//
// A plugin calls its OWN command by the fully-qualified name `plugin.<id>.<cmd>` — the same
// name the socket/CLI use; the core's cross-plugin gate treats a self-call as allowed.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useStore as useZustandStore } from 'zustand';
import {
  listProfiles,
  type ConnectionProfile,
  type ConnectionsStore,
} from '@/plugin/connections';
import type { ConnectionRuntimeStatus } from '@/components/connections/dialect';

const PLUGIN_ID = 'soksak-plugin-db-studio';

// Flattened command result — the standard envelope with `data` spread onto the top level for
// ergonomics (mirrors the live-service harness's `val`). ok:false carries code/message.
export interface CmdResult {
  ok: boolean;
  code?: string;
  message?: string;
  [k: string]: unknown;
}

// The raw core bridge — `app.commands.execute`. Undefined in the plain-web dev path (main.tsx),
// where the DB panels degrade to their empty states.
export type RawExec = (
  name: string,
  params?: Record<string, unknown>,
  opts?: { origin?: string },
) => Promise<{ ok: boolean; code?: string; message?: string; data?: unknown }>;

export interface DbSession {
  selectedProfileId: string | null;
  statuses: Record<string, ConnectionRuntimeStatus>;
  // Select a profile and ensure a held connection (db-connect) exists for it.
  select(id: string): void;
}

export interface DbHost {
  // Run one of this plugin's own commands by short name (query-run, db-connect, …).
  run(short: string, params?: Record<string, unknown>): Promise<CmdResult>;
  // True when a live core bridge is present (false in the plain-web dev path).
  live: boolean;
  connStore: ConnectionsStore;
  session: DbSession;
}

const DbHostContext = createContext<DbHost | null>(null);

function makeRun(exec: RawExec | undefined): (short: string, params?: Record<string, unknown>) => Promise<CmdResult> {
  return async (short, params) => {
    if (!exec) return { ok: false, code: 'NO_HOST', message: '코어 명령 브리지가 없습니다(웹 개발 경로)' };
    const out = await exec(`plugin.${PLUGIN_ID}.${short}`, params ?? {});
    const data = (out && typeof out === 'object' ? (out as { data?: unknown }).data : undefined) as
      | Record<string, unknown>
      | undefined;
    return { ...(out as CmdResult), ...(data ?? {}) };
  };
}

export function DbHostProvider({
  exec,
  connStore,
  children,
}: {
  exec: RawExec | undefined;
  connStore: ConnectionsStore;
  children: ReactNode;
}) {
  const run = useMemo(() => makeRun(exec), [exec]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ConnectionRuntimeStatus>>({});

  const select = useCallback(
    (id: string) => {
      setSelectedProfileId(id);
      const profile = connStore.getState().connectionProfiles[id];
      if (!profile) return;
      // Idempotent — an already-connected profile is not reopened.
      setStatuses((prev) => {
        if (prev[id] === 'connected' || prev[id] === 'connecting') return prev;
        void (async () => {
          setStatuses((s) => ({ ...s, [id]: 'connecting' }));
          // SQLite plaintext connect uses the file only; the encrypted-key path is proven at
          // the command/e2e level (secrets are the vault's domain, not this dialog).
          const params: Record<string, unknown> = { profile: id };
          if (profile.file) params.file = profile.file;
          const out = await run('db-connect', params);
          setStatuses((s) => ({ ...s, [id]: out.ok ? 'connected' : 'error' }));
        })();
        return { ...prev, [id]: 'connecting' };
      });
    },
    [connStore, run],
  );

  const value = useMemo<DbHost>(
    () => ({ run, live: exec !== undefined, connStore, session: { selectedProfileId, statuses, select } }),
    [run, exec, connStore, selectedProfileId, statuses, select],
  );

  return <DbHostContext.Provider value={value}>{children}</DbHostContext.Provider>;
}

export function useDbHost(): DbHost | null {
  return useContext(DbHostContext);
}

// Subscribe to the connections store's profile list (referentially stable per immer map).
export function useConnectionProfiles(connStore: ConnectionsStore): ConnectionProfile[] {
  const map = useZustandStore(connStore, (s) => s.connectionProfiles);
  return useMemo(() => listProfiles(map), [map]);
}

// The currently-selected profile as QueryPanel/Sync profile info, or null.
export function useSelectedProfile(host: DbHost): ConnectionProfile | null {
  const map = useZustandStore(host.connStore, (s) => s.connectionProfiles);
  const id = host.session.selectedProfileId;
  return id ? (map[id] ?? null) : null;
}
