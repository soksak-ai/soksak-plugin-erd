import { catalogToSchema, type Catalog } from '@/features/db/introspect-map';
import { buildPushPlan, type RenameHint } from '@/features/db/push-plan';
import { parseMig, serializeMig } from '@/features/migration/mig-dsl';
import { getSQLGenerator, splitStatements } from '@/features/migration/sql-generator';
import type { ERDSchema, Table, Relationship } from '@/types/schema';
import type { DialectId } from '@/features/db/dialect/types';

// Fully-qualified command address of this plugin — nested service ops route through it.
const SELF = 'plugin.soksak-plugin-db-studio';

// Orchestration commands that turn the sidecar's headless db-introspect catalog
// into working-model actions. These are plugin-runtime commands (NOT bind:service):
// the caller runs the service op first (plugin.soksak-plugin-db-studio.db-introspect)
// and passes its `data` here. The plugin never invokes a service op itself — so the
// core's managed commands.execute boundary is never crossed. Applying a push plan is
// done by db-exec (a service op the caller drives), which carries the destructive gate.

// Response envelope of a nested command execution (core commands.execute contract).
type Outcome = { ok: boolean; code: string; message: string; data?: Record<string, unknown> };

// Invocation context injected into a handler (api.ts §5): nested executions inherit
// the parent's origin/correlation. migration-run drives the db-migrate / migration-applied
// service ops through inv.execute — never app.commands.execute directly (that disguises
// the schedule/agent origin as a human one).
interface Invocation {
  origin?: string;
  parent?: string;
  execute: (name: string, params?: Record<string, unknown>) => Promise<Outcome>;
}

// Minimal fs surface (mirror of commands.ts PluginFs) — injected only under the fs gate.
interface DbFs {
  readText?: (
    path: string,
    offset?: number,
  ) => Promise<{ text: string; truncated: boolean; totalBytes: number }>;
  list?: (path: string, opts?: { meta?: boolean }) => Promise<unknown>;
}

interface DbCommandsCtx {
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
          danger?: 'destructive' | 'inject';
          handler: (params: unknown, inv?: Invocation) => Promise<unknown>;
        },
      ): { dispose(): void };
    };
    fs?: DbFs;
  };
}

interface ErdStoreState {
  tables: Record<string, Table>;
  relationships: Record<string, Relationship>;
  dialect: DialectId;
  loadProject(data: {
    tables: Record<string, Table>;
    relationships: Record<string, Relationship>;
  }): void;
}
interface ErdStore {
  getState(): ErdStoreState;
}

type Ok = { ok: true; [k: string]: unknown };
type Err = { ok: false; code: string; message: string; [k: string]: unknown };

// Join an absolute dir with a file name (no double slash). Mirror of commands.ts.
function joinPath(dir: string, file: string): string {
  return dir.endsWith('/') ? `${dir}${file}` : `${dir}/${file}`;
}

// Extract `.mig` file names (non-dir) from an fs.list ChildListing, sorted. The name is
// the ordering key — `.mig` files are stamped YYYYMMDD_HHIISS_NNN so a lexical sort is
// application order. Mirror of commands.ts extractMigNames.
function extractMigNames(listing: unknown): string[] {
  const children =
    (listing as { children?: Array<{ name?: string; dir?: boolean }> } | null)?.children ?? [];
  return children
    .filter((c) => c && c.dir !== true && typeof c.name === 'string' && c.name.endsWith('.mig'))
    .map((c) => c.name as string)
    .sort();
}

// SHA-256 hex of a `.mig` text — the ledger checksum db-migrate verifies. Web Crypto is
// present in both the plugin runtime (webview) and the test runtime (Node global crypto).
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isDialect(v: unknown): v is DialectId {
  return v === 'sqlite' || v === 'mysql' || v === 'postgresql';
}

export function registerDbCommands(ctx: DbCommandsCtx, store: ErdStore): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  // db-pull-apply — reverse sync: fold a db-introspect catalog into the model.
  ctx.subscriptions.push(
    register('db-pull-apply', {
      description:
        'Reverse sync: apply a db-introspect catalog into the working ERD model (run db-introspect first, pass its data as `catalog`).',
      triggers: { ko: '리버스 스키마 introspect 모델 반영 가져오기' },
      message: (d) => `테이블 ${(d as { tables?: number }).tables ?? 0}개를 모델로 가져왔습니다`,
      params: {
        catalog: { type: 'object', required: true, description: 'db-introspect result (its data field)' },
      },
      handler: async (params): Promise<Ok | Err> => {
        const p = (params ?? {}) as { catalog?: unknown };
        const catalog = p.catalog as Catalog | undefined;
        if (!catalog || !Array.isArray(catalog.tables)) {
          return { ok: false, code: 'INVALID_INPUT', message: 'catalog { tables: [...] } required' };
        }
        const { schema, losses } = catalogToSchema(catalog);
        store.getState().loadProject({
          tables: schema.tables,
          relationships: schema.relationships,
        });
        return {
          ok: true,
          tables: Object.keys(schema.tables).length,
          relationships: Object.keys(schema.relationships).length,
          losses,
        };
      },
    }),
  );

  // db-push-plan — forward sync (plan only): diff the model against a live catalog.
  ctx.subscriptions.push(
    register('db-push-plan', {
      description:
        'Forward sync (plan): diff the working model against the live DB and emit a reviewable .mig plus the DDL. Apply it through migration-run/db-migrate (transactional + ledger), not raw exec — DDL only travels as a reviewed .mig artifact (plan §5).',
      triggers: { ko: '포워드 푸시 플랜 diff DDL 생성' },
      params: {
        liveCatalog: { type: 'object', required: true, description: 'db-introspect result of the live DB' },
        dialect: { type: 'string', description: 'sqlite|mysql|postgresql (defaults to the model dialect)' },
        renameHints: {
          type: 'array',
          description:
            'Confirmed renames [{level:"table"|"column", table?, from, to}] — reconcile a reverse drop+create into a non-destructive renameTable/renameColumn (data preserved).',
        },
      },
      handler: async (params): Promise<Ok | Err> => {
        const p = (params ?? {}) as { liveCatalog?: unknown; dialect?: string; renameHints?: unknown };
        const liveCatalog = p.liveCatalog as Catalog | undefined;
        if (!liveCatalog || !Array.isArray(liveCatalog.tables)) {
          return { ok: false, code: 'INVALID_INPUT', message: 'liveCatalog { tables: [...] } required' };
        }
        const s = store.getState();
        const current: ERDSchema = { tables: s.tables, relationships: s.relationships, layers: {} };
        const { schema: live } = catalogToSchema(liveCatalog);
        const dialect = (p.dialect as DialectId | undefined) ?? s.dialect;
        const renameHints = Array.isArray(p.renameHints) ? (p.renameHints as RenameHint[]) : [];
        const plan = buildPushPlan(current, live, dialect, renameHints);
        return {
          ok: true,
          dialect,
          // The reviewable artifact: the diff serialized as a .mig. Applying it
          // goes through db-migrate (ledger + checksum), so what runs is exactly
          // what was reviewed. `sql` is the rendered preview of that .mig.
          mig: serializeMig(plan.ops),
          sql: plan.sql,
          destructive: plan.destructive.map((d) => ({ op: d.op.type, reason: d.reason })),
          renamesNeedingConfirm: plan.renamesNeedingConfirm.map((r) => ({
            level: r.level,
            table: r.table,
            from: r.from,
            to: r.to,
          })),
        };
      },
    }),
  );

  // migration-run — file→ledger orchestration. Diffs the `.mig` files under `dir` against
  // the profile's applied ledger, renders each pending `.mig` to dialect DDL, and (on
  // confirm) applies them in order through the db-migrate service op — transactional +
  // checksum-verified. Same split as db-pull/db-push: this runtime command owns no DB
  // access; every service op (migration-applied, db-migrate) travels through inv.execute,
  // so the core's managed boundary (gate + origin inheritance) is never bypassed.
  ctx.subscriptions.push(
    register('migration-run', {
      description:
        'Apply pending file-based migrations: diff the `.mig` files under `dir` against the profile ledger, render each pending one to DDL, and (with confirm:true) apply them in order via db-migrate (transactional + checksum ledger). Without confirm it returns the plan (pending ids + generated SQL) for review.',
      triggers: { ko: '마이그레이션 실행 적용 파일 pending 원장' },
      danger: 'destructive',
      message: (d) => {
        const r = d as { mode?: string; count?: number };
        return r.mode === 'applied'
          ? `마이그레이션 ${r.count ?? 0}건을 적용했습니다`
          : `적용 대기 마이그레이션 ${r.count ?? 0}건`;
      },
      params: {
        profile: { type: 'string', required: true, description: 'Connection profile id (the target DB)' },
        dir: { type: 'string', required: true, description: 'Absolute directory holding the `.mig` files' },
        confirm: {
          type: 'boolean',
          description: 'false/omitted → return the plan only; true → apply the pending migrations',
        },
        dialect: {
          type: 'string',
          enum: ['sqlite', 'mysql', 'postgresql'],
          description: 'DDL dialect (defaults to the working-model dialect)',
        },
      },
      handler: async (params, inv): Promise<Ok | Err> => {
        const p = (params ?? {}) as { profile?: unknown; dir?: unknown; confirm?: unknown; dialect?: unknown };
        const profile = typeof p.profile === 'string' ? p.profile : '';
        const dir = typeof p.dir === 'string' ? p.dir : '';
        if (!profile) return { ok: false, code: 'INVALID_INPUT', message: 'profile required' };
        if (!dir) return { ok: false, code: 'INVALID_INPUT', message: 'dir required' };
        if (p.dialect !== undefined && !isDialect(p.dialect)) {
          return { ok: false, code: 'INVALID_INPUT', message: `dialect 미지원: '${String(p.dialect)}'(sqlite|mysql|postgresql)` };
        }

        const exec = inv?.execute;
        if (!exec) return { ok: false, code: 'GATE_REQUIRED', message: 'command execute 표면 필요' };
        const fs = ctx.app.fs;
        if (!fs?.list || !fs.readText) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };

        // (a) applied ledger → set of applied ids (id = `.mig` file name).
        const appliedOut = await exec(`${SELF}.migration-applied`, { profile });
        if (!appliedOut.ok) {
          return { ok: false, code: appliedOut.code || 'SERVICE_ERROR', message: appliedOut.message };
        }
        const ledger = (appliedOut.data?.migrations as Array<{ id?: unknown }> | undefined) ?? [];
        const applied = new Set(ledger.map((m) => String(m.id)));

        // (b) list `.mig` files (ordered) → pending = not-yet-applied, in order.
        let files: string[];
        try {
          files = extractMigNames(await fs.list(dir));
        } catch (e) {
          return { ok: false, code: 'FS_ERROR', message: `dir 목록 실패: ${e instanceof Error ? e.message : String(e)}` };
        }
        const pendingFiles = files.filter((f) => !applied.has(f));

        const dialect: DialectId = isDialect(p.dialect) ? p.dialect : store.getState().dialect;
        const gen = getSQLGenerator(dialect);

        // (c) render each pending `.mig` → { id, checksum, statements }.
        const plan: Array<{ id: string; checksum: string; statements: string[] }> = [];
        for (const file of pendingFiles) {
          const { text } = await fs.readText(joinPath(dir, file));
          const { ops } = parseMig(text);
          const statements = splitStatements(gen.generateBatch(ops));
          const checksum = await sha256Hex(text);
          plan.push({ id: file, checksum, statements });
        }

        // Preview: without confirm, return the plan and touch nothing.
        if (p.confirm !== true) {
          return {
            ok: true,
            mode: 'plan',
            profile,
            dir,
            dialect,
            count: plan.length,
            pending: plan.map((m) => ({ id: m.id, statements: m.statements, sql: m.statements.join('\n') })),
          };
        }

        // Apply: db-migrate per pending, in order. A failure stops the run and reports
        // what applied so far (each db-migrate is its own transaction + ledger row).
        const results: Array<{ id: string; applied: boolean; message: string }> = [];
        for (const m of plan) {
          const out = await exec(`${SELF}.db-migrate`, {
            profile,
            id: m.id,
            checksum: m.checksum,
            statements: m.statements,
          });
          if (!out.ok) {
            return {
              ok: false,
              code: out.code || 'MIGRATE_FAILED',
              message: `migration failed at ${m.id}: ${out.message}`,
              applied: results,
            };
          }
          results.push({ id: m.id, applied: (out.data?.applied as boolean | undefined) ?? true, message: out.message });
        }
        return { ok: true, mode: 'applied', profile, dir, dialect, count: results.length, applied: results };
      },
    }),
  );
}
