// Wiring for the three DB bottom-panel tabs (plan §6 P2–P4). Each container owns its ephemeral
// state, turns the pure presentation panels' callbacks into commands, and reuses the SAME pure
// modules the runtime commands use (catalogToSchema / buildPushPlan / diffSchemas / serializeMig)
// so the view's diff is byte-identical to what db-push-plan/db-pull-apply produce. Reads travel
// through db-introspect; writes through db-migrate / db-pull-apply / migration-run (each gated).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { toast } from '@/store/toast-store';
import { useDbHost, useSelectedProfile, type DbHost, type CmdResult } from '@/components/host/db-host';
import {
  QueryPanel,
  type QueryResult,
  type QueryColumn,
  type QueryCell,
  type QueryProfileInfo,
} from '@/components/panels/QueryPanel';
import {
  SyncPanel,
  type SyncObject,
  type SyncDirection,
  type SyncPreviewMode,
  type RenameChoice,
} from '@/components/panels/SyncPanel';
import {
  MigrationPanel,
  type MigrationFile,
  type MigrationTab,
  type LedgerEntry,
} from '@/components/panels/MigrationPanel';
import { catalogToSchema, type Catalog } from '@/features/db/introspect-map';
import { buildPushPlan, type DestructiveOp } from '@/features/db/push-plan';
import { diffSchemas } from '@/features/migration/diff';
import { serializeMig } from '@/features/migration/mig-dsl';
import { getSQLGenerator, splitStatements } from '@/features/migration/sql-generator';
import type { Operation } from '@/features/migration/types';
import type { DialectId } from '@/features/db/dialect/types';
import type { ERDSchema } from '@/types/schema';

function EmptyHost({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-xs text-gray-400 dark:text-zinc-600">
      {message}
    </div>
  );
}

// ── Query ────────────────────────────────────────────────────────────────────
function mapQueryResult(out: CmdResult): QueryResult {
  const cols = (out.columns as Array<{ name: string }> | undefined) ?? [];
  const rows = (out.rows as QueryCell[][] | undefined) ?? [];
  // The sidecar masks sensitive values to "<redacted:col>" before results leave it; the column
  // metadata carries no flag, so a column is masked iff its cells are redacted markers.
  const columns: QueryColumn[] = cols.map((c, ci) => ({
    name: c.name,
    masked: rows.some((r) => typeof r[ci] === 'string' && (r[ci] as string).startsWith('<redacted:')),
  }));
  return { columns, rows, truncated: !!out.truncated, rowLimit: out.rowCount as number | undefined };
}

function QueryInner({ host }: { host: DbHost }) {
  const profile = useSelectedProfile(host);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);

  const onRun = useCallback(
    async (sql: string) => {
      const id = host.session.selectedProfileId;
      if (!id) {
        toast('먼저 접속 프로필을 선택하세요', 'error');
        return;
      }
      setRunning(true);
      const out = await host.run('query-run', { profile: id, sql });
      setRunning(false);
      if (!out.ok) {
        toast(out.message ?? '쿼리 실패', 'error');
        return;
      }
      setResult(mapQueryResult(out));
    },
    [host],
  );

  const profileInfo: QueryProfileInfo | null = profile
    ? { id: profile.id, name: profile.name, dialect: profile.dialect, readOnly: profile.readOnly }
    : null;

  return <QueryPanel onRun={onRun} result={result} profile={profileInfo} running={running} />;
}

export function QueryContainer() {
  const host = useDbHost();
  if (!host || !host.live) return <EmptyHost message="앱에서 DB Studio 뷰를 열면 쿼리를 실행할 수 있습니다." />;
  return <QueryInner host={host} />;
}

// ── Sync ─────────────────────────────────────────────────────────────────────
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface MappedOp {
  object: SyncObject;
  op: Operation;
}

function mapOp(op: Operation, destructive: boolean): MappedOp {
  const p = op.params;
  const s = (k: string) => (p[k] != null ? String(p[k]) : '');
  switch (op.type) {
    case 'createTable':
      return { op, object: { name: s('name'), kind: 'add', level: 'table' } };
    case 'dropTable':
      return { op, object: { name: s('name'), kind: 'drop', level: 'table', destructive: true } };
    case 'renameTable':
      return { op, object: { name: s('to') || s('name'), kind: 'rename', level: 'table', detail: `${s('from')} → ${s('to')}` } };
    case 'addColumn':
      return { op, object: { name: `${s('table')}.${s('name')}`, kind: 'add', level: 'column' } };
    case 'dropColumn':
      return { op, object: { name: `${s('table')}.${s('name')}`, kind: 'drop', level: 'column', destructive: true } };
    case 'renameColumn':
      return { op, object: { name: `${s('table')}.${s('to')}`, kind: 'rename', level: 'column', detail: `${s('from')} → ${s('to')}` } };
    case 'modifyColumnType':
      return {
        op,
        object: { name: `${s('table')}.${s('column')}`, kind: 'change', level: 'column', detail: `${s('oldType')} → ${s('newType')}`, destructive },
      };
    default: {
      const table = s('table') || s('name');
      const col = s('column');
      const name = col ? `${table}.${col}` : table || op.type;
      return { op, object: { name, kind: 'change', level: col ? 'column' : 'table', detail: op.type, destructive } };
    }
  }
}

interface SyncPlan {
  objects: SyncObject[];
  nameToOps: Record<string, Operation[]>;
  preview: { sql: string; mig: string };
  // Reverse only — the introspected catalog handed to db-pull-apply on Apply.
  reverseCatalog?: Catalog;
}

function buildSyncPlan(direction: SyncDirection, catalog: Catalog, current: ERDSchema, dialect: DialectId): SyncPlan {
  const { schema: live } = catalogToSchema(catalog);
  let ops: Operation[];
  let destructive: DestructiveOp[] = [];
  if (direction === 'forward') {
    const plan = buildPushPlan(current, live, dialect);
    ops = plan.ops;
    destructive = plan.destructive;
  } else {
    // Reverse folds the live schema INTO the model: diff current → live.
    ops = diffSchemas(current, live);
  }
  const destSet = new Set(destructive.map((d) => d.op));
  const mapped = ops.map((op) => mapOp(op, destSet.has(op)));
  const nameToOps: Record<string, Operation[]> = {};
  const objects: SyncObject[] = [];
  const seen = new Set<string>();
  for (const m of mapped) {
    (nameToOps[m.object.name] ??= []).push(m.op);
    if (!seen.has(m.object.name)) {
      seen.add(m.object.name);
      objects.push(m.object);
    }
  }
  const preview = { sql: getSQLGenerator(dialect).generateBatch(ops), mig: serializeMig(ops) };
  return direction === 'reverse'
    ? { objects, nameToOps, preview, reverseCatalog: catalog }
    : { objects, nameToOps, preview };
}

function SyncInner({ host }: { host: DbHost }) {
  const tables = useStore((s) => s.tables);
  const relationships = useStore((s) => s.relationships);
  const dialect = useStore((s) => s.dialect);
  const selectedId = host.session.selectedProfileId;

  const [direction, setDirection] = useState<SyncDirection>('reverse');
  const [plan, setPlan] = useState<SyncPlan>({ objects: [], nameToOps: {}, preview: { sql: '', mig: '' } });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [renameChoices, setRenameChoices] = useState<Record<string, RenameChoice>>({});
  const [previewMode, setPreviewMode] = useState<SyncPreviewMode>('sql');
  const [applying, setApplying] = useState(false);

  const current = useMemo<ERDSchema>(() => ({ tables, relationships, layers: {} }), [tables, relationships]);

  const load = useCallback(async () => {
    if (!selectedId) {
      setPlan({ objects: [], nameToOps: {}, preview: { sql: '', mig: '' } });
      return;
    }
    const intro = await host.run('db-introspect', { profile: selectedId });
    if (!intro.ok) {
      toast(intro.message ?? '스키마 조회 실패', 'error');
      return;
    }
    const catalog: Catalog = { tables: (intro.tables as Catalog['tables'] | undefined) ?? [] };
    setPlan(buildSyncPlan(direction, catalog, current, dialect));
    setChecked({});
  }, [host, selectedId, direction, current, dialect]);

  useEffect(() => {
    void load();
  }, [load]);

  const isChecked = useCallback(
    (obj: SyncObject) => checked[obj.name] ?? !obj.destructive,
    [checked],
  );

  const onApply = useCallback(async () => {
    if (!selectedId) {
      toast('먼저 접속 프로필을 선택하세요', 'error');
      return;
    }
    setApplying(true);
    try {
      if (direction === 'reverse') {
        // Reverse applies to the working model (no DDL). db-pull-apply updates the shared store.
        const out = await host.run('db-pull-apply', { catalog: plan.reverseCatalog ?? { tables: [] } });
        if (!out.ok) {
          toast(out.message ?? '리버스 적용 실패', 'error');
          return;
        }
        toast(`리버스: 테이블 ${(out.tables as number | undefined) ?? 0}개를 모델로 가져왔습니다`, 'success');
      } else {
        // Forward applies only the checked ops (destructive rows default off) as one reviewed
        // migration through db-migrate (transactional + checksum ledger).
        const chosen = plan.objects.filter((o) => isChecked(o));
        const applyOps = chosen.flatMap((o) => plan.nameToOps[o.name] ?? []);
        if (applyOps.length === 0) {
          toast('적용할 항목이 없습니다', 'error');
          return;
        }
        const statements = splitStatements(getSQLGenerator(dialect).generateBatch(applyOps));
        const mig = serializeMig(applyOps);
        const checksum = await sha256Hex(mig);
        const out = await host.run('db-migrate', {
          profile: selectedId,
          id: `forward-${checksum.slice(0, 12)}`,
          checksum,
          statements,
        });
        if (!out.ok) {
          toast(out.message ?? '포워드 적용 실패', 'error');
          return;
        }
        toast(`포워드: 문 ${statements.length}개를 적용했습니다`, 'success');
      }
      await load();
    } finally {
      setApplying(false);
    }
  }, [host, selectedId, direction, plan, isChecked, dialect, load]);

  return (
    <SyncPanel
      direction={direction}
      onDirectionChange={setDirection}
      objects={plan.objects}
      checked={checked}
      onToggle={(name, c) => setChecked((prev) => ({ ...prev, [name]: c }))}
      renameChoices={renameChoices}
      onRenameChoice={(name, choice) => setRenameChoices((prev) => ({ ...prev, [name]: choice }))}
      previewMode={previewMode}
      onPreviewModeChange={setPreviewMode}
      preview={plan.preview}
      applying={applying}
      onApply={onApply}
    />
  );
}

export function SyncContainer() {
  const host = useDbHost();
  if (!host || !host.live) return <EmptyHost message="앱에서 DB Studio 뷰를 열면 스키마를 동기화할 수 있습니다." />;
  return <SyncInner host={host} />;
}

// ── Migration ──────────────────────────────────────────────────────────────────
interface MigPending {
  id: string;
  sql?: string;
}

function MigrationInner({ host }: { host: DbHost }) {
  const dialect = useStore((s) => s.dialect);
  const selectedId = host.session.selectedProfileId;

  const [dir, setDir] = useState('');
  const [tab, setTab] = useState<MigrationTab>('files');
  const [pending, setPending] = useState<MigPending[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    if (!selectedId || !dir.trim()) {
      setPending([]);
      setLedger([]);
      return;
    }
    // Plan (confirm omitted) — pending files + rendered SQL, touches nothing.
    const planOut = await host.run('migration-run', { profile: selectedId, dir: dir.trim() });
    if (planOut.ok) {
      setPending(((planOut.pending as Array<{ id: string; sql?: string }> | undefined) ?? []).map((m) => ({ id: m.id, sql: m.sql })));
    } else {
      toast(planOut.message ?? '마이그레이션 조회 실패', 'error');
    }
    const applied = await host.run('migration-applied', { profile: selectedId });
    if (applied.ok) {
      setLedger(
        ((applied.migrations as Array<{ id: string; checksum?: string; appliedAt?: string }> | undefined) ?? []).map((m) => ({
          file: m.id,
          checksum: m.checksum,
          appliedAt: m.appliedAt ?? '',
        })),
      );
    }
  }, [host, selectedId, dir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const files: MigrationFile[] = useMemo(
    () => pending.map((m) => ({ file: m.id, checksumOk: true, applied: false, sql: m.sql })),
    [pending],
  );

  const onRun = useCallback(async () => {
    if (!selectedId || !dir.trim()) {
      toast('프로필과 .mig 디렉터리를 지정하세요', 'error');
      return;
    }
    setRunning(true);
    const out = await host.run('migration-run', { profile: selectedId, dir: dir.trim(), confirm: true });
    setRunning(false);
    if (!out.ok) {
      toast(out.message ?? '마이그레이션 실패', 'error');
      return;
    }
    toast(`마이그레이션 ${(out.count as number | undefined) ?? 0}건을 적용했습니다`, 'success');
    await refresh();
  }, [host, selectedId, dir, refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 dark:border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-500">.mig dir</span>
        <input
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          placeholder="/absolute/path/to/migrations"
          spellCheck={false}
          className="flex-1 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-950 px-2 py-1 font-mono text-xs text-gray-800 dark:text-zinc-200 outline-none focus-visible:border-blue-500"
        />
      </div>
      <div className="min-h-0 flex-1">
        <MigrationPanel
          dialect={dialect}
          activeTab={tab}
          onTabChange={setTab}
          files={files}
          expandedFile={expanded}
          onToggleExpand={(f) => setExpanded((prev) => (prev === f ? null : f))}
          onPlan={() => void refresh()}
          onRun={() => void onRun()}
          running={running}
          ledger={ledger}
        />
      </div>
    </div>
  );
}

export function MigrationContainer() {
  const host = useDbHost();
  if (!host || !host.live) return <EmptyHost message="앱에서 DB Studio 뷰를 열면 마이그레이션을 실행할 수 있습니다." />;
  return <MigrationInner host={host} />;
}
