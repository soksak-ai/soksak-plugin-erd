import { describe, it, expect, vi } from 'vitest';
import { registerDbCommands } from './db-commands';

function harness(state: Record<string, unknown>) {
  const cmds: Record<string, (p: unknown) => Promise<unknown>> = {};
  const ctx = {
    subscriptions: [] as Array<{ dispose(): void }>,
    app: {
      commands: {
        register: (name: string, spec: { handler: (p: unknown) => Promise<unknown> }) => {
          cmds[name] = spec.handler;
          return { dispose() {} };
        },
      },
    },
  };
  const loadProject = vi.fn();
  const store = { getState: () => ({ ...state, loadProject }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerDbCommands(ctx as any, store as any);
  return { cmds, loadProject };
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
