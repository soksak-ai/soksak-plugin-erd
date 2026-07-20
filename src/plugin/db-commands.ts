import { catalogToSchema, type Catalog } from '@/features/db/introspect-map';
import { buildPushPlan } from '@/features/db/push-plan';
import type { ERDSchema, Table, Relationship } from '@/types/schema';
import type { DialectId } from '@/features/db/dialect/types';

// Orchestration commands that turn the sidecar's headless db-introspect catalog
// into working-model actions. These are plugin-runtime commands (NOT bind:service):
// the caller runs the service op first (plugin.soksak-plugin-db-studio.db-introspect)
// and passes its `data` here. The plugin never invokes a service op itself — so the
// core's managed commands.execute boundary is never crossed. Applying a push plan is
// done by db-exec (a service op the caller drives), which carries the destructive gate.

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
          handler: (params: unknown) => Promise<unknown>;
        },
      ): { dispose(): void };
    };
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
type Err = { ok: false; code: string; message: string };

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
        'Forward sync (plan): the DDL to push the working model onto a live database (pass the live db-introspect catalog). Applying is done by db-exec, which is gated.',
      triggers: { ko: '포워드 푸시 플랜 diff DDL 생성' },
      params: {
        liveCatalog: { type: 'object', required: true, description: 'db-introspect result of the live DB' },
        dialect: { type: 'string', description: 'sqlite|mysql|postgresql (defaults to the model dialect)' },
      },
      handler: async (params): Promise<Ok | Err> => {
        const p = (params ?? {}) as { liveCatalog?: unknown; dialect?: string };
        const liveCatalog = p.liveCatalog as Catalog | undefined;
        if (!liveCatalog || !Array.isArray(liveCatalog.tables)) {
          return { ok: false, code: 'INVALID_INPUT', message: 'liveCatalog { tables: [...] } required' };
        }
        const s = store.getState();
        const current: ERDSchema = { tables: s.tables, relationships: s.relationships, layers: {} };
        const { schema: live } = catalogToSchema(liveCatalog);
        const dialect = (p.dialect as DialectId | undefined) ?? s.dialect;
        const plan = buildPushPlan(current, live, dialect);
        return {
          ok: true,
          dialect,
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
}
