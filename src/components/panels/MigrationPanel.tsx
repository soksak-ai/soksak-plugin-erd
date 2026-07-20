// MigrationPanel — pure presentation of the .mig migration surface (plan §6-P3).
//
// This component NEVER invokes a command. The wiring supplies the file list (from a
// directory scan + checksum verification), the plan SQL for the expanded file (from
// migration-plan / db-push-plan), the run stepper state (from migration-run progress
// events), and the applied ledger (from migration-applied / migration-history). Every
// button reports intent through a callback; the wiring turns onRun into the real
// migration-run/db-migrate call, which carries the destructive gate.
//
// Contract highlights (plan §6-P3):
//   - .mig list with checksum ✓/⚠ and applied state
//   - [Plan] accordion: rendered SQL + a transaction-guarantee label. MySQL is honest about
//     implicit-commit / partial-apply; SQLite and PostgreSQL are atomic per file.
//   - [Run] stepper: per-file progress (pending / running / done / failed)
//   - history sub-tab: the applied ledger

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Play,
  Loader2,
  CircleCheck,
  CircleX,
  Circle,
  Dot,
} from 'lucide-react';

export type MigrationDialect = 'sqlite' | 'mysql' | 'postgresql';
export type MigrationTab = 'files' | 'history';
export type RunStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface MigrationFile {
  /** Filename, e.g. "0003_add_orders.mig" — the identity for data-node and expansion. */
  file: string;
  /** Checksum verified (✓) vs mismatch/tampered (⚠). */
  checksumOk: boolean;
  applied: boolean;
  /** Rendered DDL for the [Plan] accordion (present once planned). */
  sql?: string;
  /** Operation count, shown as a hint. */
  ops?: number;
  /** Optional lint problems surfaced by the wiring. */
  lint?: string[];
}

export interface RunStep {
  file: string;
  status: RunStepStatus;
  message?: string;
}

export interface LedgerEntry {
  /** Applied file / migration id. */
  file: string;
  version?: string;
  /** ISO string or epoch ms — rendered as-is when a string. */
  appliedAt: string | number;
  checksum?: string;
}

export interface MigrationPanelProps {
  dialect: MigrationDialect;

  activeTab?: MigrationTab;
  onTabChange(tab: MigrationTab): void;

  files: MigrationFile[];
  expandedFile?: string | null;
  onToggleExpand(file: string): void;
  onPlan(file: string): void;

  /** Run all pending (no arg) or a single file. */
  onRun(file?: string): void;
  running?: boolean;
  runSteps?: RunStep[];

  ledger?: LedgerEntry[];
}

// Per-dialect transaction guarantee for a single .mig file (plan §runbook / §197).
function txGuarantee(dialect: MigrationDialect): { label: string; warn: boolean } {
  if (dialect === 'mysql') {
    return {
      label: 'MySQL: DDL implicitly commits — a failed file can leave a PARTIAL apply',
      warn: true,
    };
  }
  return { label: `${dialect === 'sqlite' ? 'SQLite' : 'PostgreSQL'}: atomic — the whole file rolls back on failure`, warn: false };
}

function StepIcon({ status }: { status: RunStepStatus }) {
  if (status === 'running') return <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500 dark:text-blue-400" />;
  if (status === 'done') return <CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (status === 'failed') return <CircleX className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />;
  return <Circle className="size-3.5 shrink-0 text-gray-300 dark:text-zinc-700" />;
}

function formatAppliedAt(at: string | number): string {
  if (typeof at === 'number') return new Date(at).toISOString().replace('T', ' ').slice(0, 19);
  return at;
}

function FileRow({
  file,
  expanded,
  dialect,
  onToggleExpand,
  onPlan,
  onRun,
  running,
}: {
  file: MigrationFile;
  expanded: boolean;
  dialect: MigrationDialect;
  onToggleExpand(file: string): void;
  onPlan(file: string): void;
  onRun(file?: string): void;
  running?: boolean;
}) {
  const tx = txGuarantee(dialect);
  return (
    <div
      data-node={`migration-item/${file.file}`}
      className="rounded border border-gray-200 dark:border-zinc-800"
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          onClick={() => onToggleExpand(file.file)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-gray-400 dark:text-zinc-600" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-gray-400 dark:text-zinc-600" />
          )}
          {file.checksumOk ? (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <span className="truncate font-mono text-xs text-gray-800 dark:text-zinc-200">{file.file}</span>
          {typeof file.ops === 'number' && (
            <span className="shrink-0 text-[10px] text-gray-400 dark:text-zinc-600">{file.ops} ops</span>
          )}
        </button>
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
            file.applied
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400',
          )}
        >
          {file.applied ? 'applied' : 'pending'}
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0 text-gray-500 dark:text-zinc-400"
          onClick={() => onPlan(file.file)}
        >
          Plan
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-zinc-800 p-2">
          <div
            className={cn(
              'mb-2 flex items-center gap-1.5 text-[11px]',
              tx.warn ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-zinc-500',
            )}
          >
            {tx.warn && <AlertTriangle className="size-3 shrink-0" />}
            {tx.label}
          </div>
          {file.lint && file.lint.length > 0 && (
            <ul className="mb-2 space-y-0.5">
              {file.lint.map((l, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {l}
                </li>
              ))}
            </ul>
          )}
          {file.sql ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 dark:bg-zinc-950/50 p-2 font-mono text-[11px] leading-relaxed text-gray-700 dark:text-zinc-300">
              <code>{file.sql}</code>
            </pre>
          ) : (
            <div className="text-[11px] text-gray-400 dark:text-zinc-600">Press Plan to render the SQL.</div>
          )}
          {!file.applied && (
            <div className="mt-2 flex justify-end">
              <Button
                size="xs"
                className="bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onRun(file.file)}
                disabled={running || !file.checksumOk}
              >
                <Play className="size-3" />
                Run this file
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS: Array<{ id: MigrationTab; label: string }> = [
  { id: 'files', label: 'Files' },
  { id: 'history', label: 'History' },
];

export function MigrationPanel({
  dialect,
  activeTab = 'files',
  onTabChange,
  files,
  expandedFile,
  onToggleExpand,
  onPlan,
  onRun,
  running,
  runSteps,
  ledger = [],
}: MigrationPanelProps) {
  const pendingCount = files.filter((f) => !f.applied).length;
  const hasChecksumWarning = files.some((f) => !f.checksumOk);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 dark:border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200',
              )}
            >
              {tab.label}
              {tab.id === 'files' && hasChecksumWarning && (
                <span className="ml-1 inline-block size-1.5 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>
        {activeTab === 'files' && (
          <Button
            data-node="migration-run-btn"
            size="xs"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => onRun()}
            disabled={running || pendingCount === 0}
          >
            {running ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
            Run {pendingCount} pending
          </Button>
        )}
      </div>

      {activeTab === 'files' ? (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {files.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-zinc-600">
                No .mig files
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map((file) => (
                  <FileRow
                    key={file.file}
                    file={file}
                    expanded={expandedFile === file.file}
                    dialect={dialect}
                    onToggleExpand={onToggleExpand}
                    onPlan={onPlan}
                    onRun={onRun}
                    running={running}
                  />
                ))}
              </div>
            )}
          </div>

          {runSteps && runSteps.length > 0 && (
            <div className="min-h-0 w-56 shrink-0 overflow-auto border-l border-gray-200 dark:border-zinc-800 p-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-600">
                Run progress
              </div>
              <div className="space-y-1">
                {runSteps.map((step) => (
                  <div key={step.file} className="flex items-center gap-2">
                    <StepIcon status={step.status} />
                    <span className="truncate font-mono text-[11px] text-gray-700 dark:text-zinc-300">
                      {step.file}
                    </span>
                  </div>
                ))}
              </div>
              {runSteps.some((s) => s.status === 'failed') && dialect === 'mysql' && (
                <div className="mt-2 flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  A failed file may be partially applied — check for drift before retrying.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {ledger.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-zinc-600">
              No applied migrations
            </div>
          ) : (
            <div className="space-y-0.5">
              {ledger.map((entry, i) => (
                <div
                  key={`${entry.file}-${i}`}
                  className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                >
                  <Dot className="size-4 shrink-0 text-emerald-500" />
                  <span className="truncate font-mono text-xs text-gray-800 dark:text-zinc-200">
                    {entry.file}
                  </span>
                  {entry.version && (
                    <span className="shrink-0 text-[10px] text-gray-400 dark:text-zinc-600">
                      v{entry.version}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-500 dark:text-zinc-500">
                    {formatAppliedAt(entry.appliedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
