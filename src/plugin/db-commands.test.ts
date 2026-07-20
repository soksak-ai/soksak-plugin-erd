import { describe, it, expect, vi } from 'vitest';
import { registerDbCommands } from './db-commands';

type Inv = {
  execute: (name: string, params?: Record<string, unknown>) => Promise<{
    ok: boolean;
    code: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
};

function harness(
  state: Record<string, unknown>,
  opts: {
    fs?: {
      list?: (path: string) => Promise<unknown>;
      readText?: (path: string) => Promise<{ text: string; truncated: boolean; totalBytes: number }>;
    };
  } = {},
) {
  const cmds: Record<string, (p: unknown, inv?: Inv) => Promise<unknown>> = {};
  const ctx = {
    subscriptions: [] as Array<{ dispose(): void }>,
    app: {
      commands: {
        register: (name: string, spec: { handler: (p: unknown, inv?: Inv) => Promise<unknown> }) => {
          cmds[name] = spec.handler;
          return { dispose() {} };
        },
      },
      fs: opts.fs,
    },
  };
  const loadProject = vi.fn();
  const store = { getState: () => ({ ...state, loadProject }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerDbCommands(ctx as any, store as any);
  return { cmds, loadProject };
}

// A `.mig` that parses to a single createTable op → one DDL statement per file.
const migText = (table: string) => `up {\n  create table ${table} ( id integer );\n}`;

// Mock inv.execute that routes migration-applied → the given ledger and records db-migrate
// calls in order. Returns the recorded db-migrate calls for assertion.
function makeInv(applied: Array<{ id: string }>) {
  const migrateCalls: Array<Record<string, unknown>> = [];
  const execute = vi.fn(async (name: string, params?: Record<string, unknown>) => {
    if (name.endsWith('.migration-applied')) {
      return { ok: true, code: 'OK', message: '', data: { migrations: applied, count: applied.length } };
    }
    if (name.endsWith('.db-migrate')) {
      migrateCalls.push(params ?? {});
      return { ok: true, code: 'OK', message: `migration applied: ${params?.id}`, data: { applied: true, id: params?.id } };
    }
    return { ok: false, code: 'UNKNOWN_COMMAND', message: name };
  });
  return { inv: { execute } as Inv, execute, migrateCalls };
}

// fs mock over an in-memory { fileName: migText } map.
function makeFs(files: Record<string, string>) {
  return {
    list: vi.fn(async () => ({
      children: Object.keys(files).map((name) => ({ name, dir: false })),
    })),
    readText: vi.fn(async (path: string) => {
      const name = path.slice(path.lastIndexOf('/') + 1);
      return { text: files[name], truncated: false, totalBytes: files[name].length };
    }),
  };
}

describe('db-commands orchestration (split design — no plugin→service call)', () => {
  it('db-pull-apply: catalog → model via loadProject', async () => {
    const { cmds, loadProject } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' });
    const catalog = {
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', notnull: true, pk: true, default: null }],
        },
      ],
    };
    const r = (await cmds['db-pull-apply']({ catalog })) as { ok: boolean; tables: number };
    expect(r.ok).toBe(true);
    expect(r.tables).toBe(1);
    expect(loadProject).toHaveBeenCalledOnce();
  });

  it('db-pull-apply: bad input is rejected', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' });
    const r = (await cmds['db-pull-apply']({})) as { ok: boolean; code: string };
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_INPUT');
  });

  it('db-push-plan: model vs live diff → DDL + destructive drop', async () => {
    // Model has `orders` (live lacks it → CREATE); live has `legacy` (model lacks → DROP = destructive).
    const orders: Record<string, unknown> = {
      id: 't1',
      name: 'orders',
      columns: [
        {
          id: 'c1',
          name: 'id',
          dataType: 'INTEGER',
          nullable: false,
          autoIncrement: true,
          isPrimaryKey: true,
          isUnique: false,
        },
      ],
      indexes: [],
    };
    const { cmds } = harness({ tables: { t1: orders }, relationships: {}, dialect: 'sqlite' });
    const liveCatalog = {
      tables: [
        {
          name: 'legacy',
          columns: [{ name: 'id', type: 'INTEGER', notnull: true, pk: true, default: null }],
        },
      ],
    };
    const r = (await cmds['db-push-plan']({ liveCatalog })) as {
      ok: boolean;
      sql: string;
      destructive: Array<{ op: string; reason: string }>;
    };
    expect(r.ok).toBe(true);
    expect(r.sql).toContain('orders'); // CREATE orders
    expect(r.destructive.some((d) => /drop/i.test(d.op))).toBe(true); // DROP legacy
  });
});

describe('migration-run orchestration (file→ledger via execute, no direct service registration)', () => {
  const files = { '001_a.mig': migText('a'), '002_b.mig': migText('b') };

  it('plan mode (no confirm): computes pending in order, generates SQL, never calls db-migrate', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' }, { fs: makeFs(files) });
    const { inv, migrateCalls } = makeInv([{ id: '001_a.mig' }]); // 001 already applied
    const r = (await cmds['migration-run']({ profile: 'p', dir: '/m' }, inv)) as {
      ok: boolean;
      mode: string;
      count: number;
      pending: Array<{ id: string; statements: string[]; sql: string }>;
    };
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('plan');
    expect(r.count).toBe(1);
    expect(r.pending.map((x) => x.id)).toEqual(['002_b.mig']); // only the unapplied one
    expect(r.pending[0].statements.length).toBeGreaterThan(0);
    expect(r.pending[0].sql).toMatch(/create table/i);
    expect(migrateCalls.length).toBe(0); // plan never applies
  });

  it('confirm mode: applies every pending in order via db-migrate with a sha256 checksum', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' }, { fs: makeFs(files) });
    const { inv, migrateCalls } = makeInv([]); // none applied → both pending
    const r = (await cmds['migration-run']({ profile: 'p', dir: '/m', confirm: true }, inv)) as {
      ok: boolean;
      mode: string;
      count: number;
      applied: Array<{ id: string }>;
    };
    expect(r.ok).toBe(true);
    expect(r.mode).toBe('applied');
    expect(r.count).toBe(2);
    // db-migrate called once per pending, in file order.
    expect(migrateCalls.map((c) => c.id)).toEqual(['001_a.mig', '002_b.mig']);
    // Each call carries the profile, non-empty statements, and a 64-hex-char sha256 checksum.
    for (const c of migrateCalls) {
      expect(c.profile).toBe('p');
      expect(Array.isArray(c.statements) && (c.statements as unknown[]).length).toBeGreaterThan(0);
      expect(c.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('confirm mode: identical .mig text yields a stable checksum matching a raw sha256', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' }, { fs: makeFs({ '001_a.mig': migText('a') }) });
    const { inv, migrateCalls } = makeInv([]);
    await cmds['migration-run']({ profile: 'p', dir: '/m', confirm: true }, inv);
    const expected = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(migText('a')))),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(migrateCalls[0].checksum).toBe(expected);
  });

  it('rejects missing profile/dir and a missing execute surface', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' }, { fs: makeFs(files) });
    const { inv } = makeInv([]);
    const noProfile = (await cmds['migration-run']({ dir: '/m' }, inv)) as { ok: boolean; code: string };
    expect(noProfile.ok).toBe(false);
    expect(noProfile.code).toBe('INVALID_INPUT');
    const noExec = (await cmds['migration-run']({ profile: 'p', dir: '/m' })) as { ok: boolean; code: string };
    expect(noExec.ok).toBe(false);
    expect(noExec.code).toBe('GATE_REQUIRED');
  });

  it('surfaces a db-migrate failure and reports what applied before it', async () => {
    const { cmds } = harness({ tables: {}, relationships: {}, dialect: 'sqlite' }, { fs: makeFs(files) });
    const execute = vi.fn(async (name: string, params?: Record<string, unknown>) => {
      if (name.endsWith('.migration-applied')) return { ok: true, code: 'OK', message: '', data: { migrations: [] } };
      if (name.endsWith('.db-migrate') && params?.id === '002_b.mig')
        return { ok: false, code: 'CONFLICT', message: 'checksum mismatch' };
      return { ok: true, code: 'OK', message: 'applied', data: { applied: true, id: params?.id } };
    });
    const r = (await cmds['migration-run']({ profile: 'p', dir: '/m', confirm: true }, { execute } as Inv)) as {
      ok: boolean;
      code: string;
      applied: Array<{ id: string }>;
    };
    expect(r.ok).toBe(false);
    expect(r.code).toBe('CONFLICT');
    expect(r.applied.map((x) => x.id)).toEqual(['001_a.mig']); // first succeeded, stopped at second
  });
});
