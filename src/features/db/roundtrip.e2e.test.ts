import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { catalogToSchema, type Catalog } from '@/features/db/introspect-map';
import { buildPushPlan } from '@/features/db/push-plan';
import { diffSchemas } from '@/features/migration/diff';
import { getSQLGenerator } from '@/features/migration/sql-generator';
import { serializeMig, parseMig } from '@/features/migration/mig-dsl';
import { generateId } from '@/lib/id';
import type { ERDSchema, Table } from '@/types/schema';

// A diff's ops → the SQL statements of the .mig it serializes to.
function migStatements(ops: Parameters<typeof serializeMig>[0]): string[] {
  const parsed = parseMig(serializeMig(ops)).ops;
  return getSQLGenerator('sqlite')
    .generateBatch(parsed)
    .split('\n\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Live round-trip against a REAL SQLite database via the REAL sidecar binary,
// bridging the TS diff/map/plan modules with the Rust service over its NDJSON
// wire. No core, no GUI app, no publishing. Proves the whole data path:
//   reverse  : DB → db-introspect → catalogToSchema → model
//   forward/diff : model → buildPushPlan (diffSchemas → DDL) → db-exec → converge
//   forward/mig  : ops → generateBatch → db-migrate (ledger) → converge
//
// Gated on DB_STUDIO_E2E=1 so `npm test` stays hermetic; `npm run e2e:roundtrip`
// builds+stages the sidecar and runs it.

const SIDECAR =
  process.env.DB_STUDIO_SIDECAR ??
  path.join(
    os.homedir(),
    '.soksak-dev/sidecars/soksak-sidecar-db-studio/dist/soksak-sidecar-db-studio',
  );

const RUN = process.env.DB_STUDIO_E2E === '1' && fs.existsSync(SIDECAR);

// ── minimal NDJSON wire client (the core's role, from node) ──────────────────
class Wire {
  private child: ChildProcessWithoutNullStreams;
  private buf = '';
  private queue: unknown[] = [];
  private waiters: Array<(f: unknown) => void> = [];

  constructor(bin: string) {
    this.child = spawn(bin, ['serve'], { stdio: ['pipe', 'pipe', 'ignore'] });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buf += chunk;
      let nl: number;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        const frame = JSON.parse(line);
        const w = this.waiters.shift();
        if (w) w(frame);
        else this.queue.push(frame);
      }
    });
  }
  private recv(): Promise<any> {
    const q = this.queue.shift();
    if (q) return Promise.resolve(q);
    return new Promise((res) => this.waiters.push(res));
  }
  private send(frame: unknown) {
    this.child.stdin.write(JSON.stringify(frame) + '\n');
  }
  async hello(): Promise<string[]> {
    const h = await this.recv();
    expect(h.t).toBe('hello');
    this.send({ t: 'ready' });
    return h.ops as string[];
  }
  /** Run one op; throw on !ok. Returns its data. */
  async call(id: number, op: string, params: Record<string, unknown>): Promise<any> {
    this.send({
      t: 'req',
      id,
      op,
      params,
      key: `k${id}`,
      ctx: { origin: 'socket', deadlineMs: 10000 },
    });
    // read frames until the matching res (skip ev/act)
    for (;;) {
      const f = await this.recv();
      if (f.t === 'res' && f.id === id) {
        if (!f.ok) throw new Error(`op ${op} failed: ${f.code} ${f.message}`);
        return f.data;
      }
      if (f.t === 'ev' || f.t === 'act') continue;
      throw new Error(`unexpected frame for ${op}: ${JSON.stringify(f)}`);
    }
  }
  async shutdown() {
    this.send({ t: 'shutdown' });
    await new Promise((res) => this.child.on('exit', res));
  }
}

describe.skipIf(!RUN)('live SQLite round-trip via the sidecar wire', () => {
  let dir: string;
  let dbfile: string;
  let wire: Wire;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-studio-rt-'));
    dbfile = path.join(dir, 'test.db');
    wire = new Wire(SIDECAR);
    const ops = await wire.hello();
    expect(ops).toContain('db-introspect');
    expect(ops).toContain('db-exec');
    expect(ops).toContain('db-migrate');
    // create + connect, then build a starting schema with db-exec (single DDL each)
    await wire.call(1, 'db-create', { file: dbfile });
    await wire.call(2, 'db-connect', { profile: 't', file: dbfile });
    await wire.call(3, 'db-exec', {
      profile: 't',
      sql: 'CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE)',
    });
    await wire.call(4, 'db-exec', {
      profile: 't',
      sql: 'CREATE TABLE orders(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), total REAL)',
    });
    await wire.call(5, 'db-exec', {
      profile: 't',
      sql: 'CREATE INDEX idx_orders_user ON orders(user_id)',
    });
  });

  afterAll(async () => {
    if (wire) await wire.shutdown();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  async function introspect(id: number): Promise<ERDSchema> {
    const catalog = (await wire.call(id, 'db-introspect', { profile: 't' })) as Catalog;
    return catalogToSchema(catalog).schema;
  }

  it('reverse: db-introspect → catalogToSchema reconstructs the schema (tables, FK, autoInc)', async () => {
    const model = await introspect(10);
    const tables = Object.values(model.tables);
    const users = tables.find((t) => t.name === 'users');
    const orders = tables.find((t) => t.name === 'orders');
    expect(users, 'users reconstructed').toBeTruthy();
    expect(orders, 'orders reconstructed').toBeTruthy();
    // autoIncrement PK survived the round-trip
    expect(users!.columns.find((c) => c.name === 'id')?.autoIncrement).toBe(true);
    // the FK orders.user_id → users became a relationship (source = referenced parent)
    const rel = Object.values(model.relationships)[0];
    expect(rel, 'FK became a relationship').toBeTruthy();
    expect(model.tables[rel.sourceTableId].name).toBe('users');
    expect(model.tables[rel.targetTableId].name).toBe('orders');
  });

  it('forward via DIFF: buildPushPlan → db-exec converges the live DB to the model', async () => {
    const live = await introspect(20); // current DB state as a model
    // desired model = live + a new table `products`
    const products: Table = {
      id: generateId(),
      name: 'products',
      columns: [
        { id: generateId(), name: 'id', dataType: 'INTEGER', nullable: false, autoIncrement: true, isPrimaryKey: true, isUnique: false },
        { id: generateId(), name: 'title', dataType: 'TEXT', nullable: false, autoIncrement: false, isPrimaryKey: false, isUnique: false },
      ],
      indexes: [],
    };
    const target: ERDSchema = {
      tables: { ...live.tables, [products.id]: products },
      relationships: live.relationships,
      layers: {},
    };

    const plan = buildPushPlan(target, live, 'sqlite');
    expect(plan.ops.some((o) => o.type === 'createTable')).toBe(true);
    // the diff travels as a reviewable .mig, applied through the ledger (plan §5:
    // DDL only runs as a reviewed .mig artifact, never raw exec).
    await wire.call(21, 'db-migrate', {
      profile: 't',
      id: 'push-products',
      checksum: 'sha-prod',
      statements: migStatements(plan.ops),
    });

    // re-introspect: the DB now has products, and a fresh push proposes nothing new
    const after = await introspect(40);
    expect(Object.values(after.tables).some((t) => t.name === 'products')).toBe(true);
    // full convergence: after applying the diff and re-introspecting, a fresh
    // diff against the target proposes NOTHING (reverse→forward is stable).
    const residual = diffSchemas(after, target);
    expect(residual, `converged (residual: ${residual.map((o) => o.type).join(',')})`).toEqual([]);
  });

  it('forward via MIG: generateBatch → db-migrate applies + records the ledger', async () => {
    // ops → SQL statements for a migration file
    const ops = [
      { id: 'op1', type: 'addColumn' as const, timestamp: 0, params: { table: 'users', name: 'phone', dataType: 'TEXT' } },
    ];
    const statements = getSQLGenerator('sqlite')
      .generateBatch(ops)
      .split('\n\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await wire.call(50, 'db-migrate', {
      profile: 't',
      id: '001_add_phone',
      checksum: 'sha-abc',
      statements,
    });

    const ledger = (await wire.call(51, 'migration-applied', { profile: 't' })) as {
      migrations: Array<{ id: string; checksum: string }>;
    };
    expect(ledger.migrations.some((m) => m.id === '001_add_phone')).toBe(true);

    // the migration's effect is in the live DB
    const after = await introspect(52);
    const users = Object.values(after.tables).find((t) => t.name === 'users');
    expect(users!.columns.some((c) => c.name === 'phone')).toBe(true);

    // re-applying the same id is an idempotent skip (checksum match), not a re-run
    const again = (await wire.call(53, 'db-migrate', {
      profile: 't',
      id: '001_add_phone',
      checksum: 'sha-abc',
      statements,
    })) as { applied: boolean };
    expect(again.applied).toBe(false);
  });

  it('reverse RENAME reconciliation: a confirmed rename becomes a non-destructive renameTable (data preserved)', async () => {
    // a standalone table with a row of data
    await wire.call(60, 'db-exec', {
      profile: 't',
      sql: 'CREATE TABLE widgets(id INTEGER PRIMARY KEY, label TEXT)',
    });
    await wire.call(61, 'db-exec', { profile: 't', sql: "INSERT INTO widgets(label) VALUES ('w1')" });

    // reverse just this table (no stable id — as if the model can't track the rename)
    const liveCatalog = (await wire.call(62, 'db-introspect', {
      profile: 't',
      tables: ['widgets'],
    })) as Catalog;
    const live = catalogToSchema(liveCatalog).schema;
    const liveWidgets = Object.values(live.tables).find((t) => t.name === 'widgets')!;

    // target model = the same table renamed to `gadgets`
    const gadgets: Table = { ...liveWidgets, id: generateId(), name: 'gadgets' };
    const target: ERDSchema = { tables: { [gadgets.id]: gadgets }, relationships: {}, layers: {} };

    // without a hint the diff is a destructive drop+create; the pair is surfaced for confirmation
    const naive = buildPushPlan(target, live, 'sqlite');
    expect(naive.ops.some((o) => o.type === 'dropTable')).toBe(true);
    expect(
      naive.renamesNeedingConfirm.some(
        (r) => r.level === 'table' && r.from === 'widgets' && r.to === 'gadgets',
      ),
    ).toBe(true);

    // with the confirmed hint it reconciles to a non-destructive renameTable
    const plan = buildPushPlan(target, live, 'sqlite', [
      { level: 'table', from: 'widgets', to: 'gadgets' },
    ]);
    expect(plan.ops.some((o) => o.type === 'renameTable')).toBe(true);
    expect(plan.ops.some((o) => o.type === 'dropTable')).toBe(false);

    // apply via .mig; the row survives the rename (data preserved)
    await wire.call(63, 'db-migrate', {
      profile: 't',
      id: 'rename-widgets',
      checksum: 'sha-r',
      statements: migStatements(plan.ops),
    });
    const res = (await wire.call(64, 'query-run', {
      profile: 't',
      sql: 'SELECT label FROM gadgets',
    })) as { rows: unknown[][] };
    expect(res.rows[0][0]).toBe('w1');
  });
});
