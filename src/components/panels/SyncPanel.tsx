// SyncPanel — pure presentation of a reverse/forward schema-sync diff (plan §6-P2).
//
// This component NEVER invokes a command. It renders whatever diff the wiring hands it
// (the shape produced by db-push-plan / db-pull-apply, mapped into `objects` + `preview`)
// and reports every intent back through callbacks. The wiring runs db-introspect →
// db-push-plan, maps the result into these props, and turns onApply into the actual
// migration-run/db-migrate call (which carries the destructive gate).
//
// Contract highlights (plan §6-P2):
//   - direction segment [reverse][forward]
//   - object tree tinted by change kind: +add(green) ~change(amber) −drop(red) ?rename(violet)
//   - destructive rows (drop / narrowing) default UNCHECKED — the default is baked in here so
//     an uncontrolled `checked` map still starts destructive rows off.
//   - rename candidates are never auto-guessed: each offers an inline [rename] / [drop+add] choice
//   - SQL / .mig preview toggle
//   - a single [Apply] action

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Minus,
  Pencil,
  ArrowRightLeft,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export type SyncDirection = 'reverse' | 'forward';
export type SyncChangeKind = 'add' | 'change' | 'drop' | 'rename';
export type RenameChoice = 'rename' | 'drop+add';
export type SyncPreviewMode = 'sql' | 'mig';

// One row of the object tree. `name` is the stable identity used by data-node and the
// checked/renameChoice maps (a table name, or `table.column` for column-level changes).
export interface SyncObject {
  name: string;
  kind: SyncChangeKind;
  level?: 'table' | 'column';
  /** Human detail, e.g. "BIGINT → INT" for a change, or "old_name → new_name" for a rename. */
  detail?: string;
  /** Data-loss candidate (drop / narrowing modify). Such rows default unchecked. */
  destructive?: boolean;
}

export interface SyncPanelProps {
  direction: SyncDirection;
  onDirectionChange(direction: SyncDirection): void;

  objects: SyncObject[];
  /** Controlled inclusion by object name. Absent → default (destructive off, others on). */
  checked?: Record<string, boolean>;
  onToggle(name: string, checked: boolean): void;

  /** Controlled rename decisions by object name. Absent entry → 'rename' (non-destructive). */
  renameChoices?: Record<string, RenameChoice>;
  onRenameChoice(name: string, choice: RenameChoice): void;

  previewMode: SyncPreviewMode;
  onPreviewModeChange(mode: SyncPreviewMode): void;
  preview: { sql: string; mig: string };

  applying?: boolean;
  onApply(): void;
}

const KIND_META: Record<
  SyncChangeKind,
  { sign: string; label: string; icon: typeof Plus; tone: string }
> = {
  add: { sign: '+', label: 'add', icon: Plus, tone: 'text-emerald-600 dark:text-emerald-400' },
  change: { sign: '~', label: 'change', icon: Pencil, tone: 'text-amber-600 dark:text-amber-400' },
  drop: { sign: '−', label: 'drop', icon: Minus, tone: 'text-red-600 dark:text-red-400' },
  rename: { sign: '?', label: 'rename', icon: ArrowRightLeft, tone: 'text-violet-600 dark:text-violet-400' },
};

/** Default inclusion when uncontrolled: everything on except destructive rows. */
function defaultChecked(obj: SyncObject): boolean {
  return !obj.destructive;
}

const DIRECTIONS: Array<{ id: SyncDirection; label: string }> = [
  { id: 'reverse', label: 'Reverse' },
  { id: 'forward', label: 'Forward' },
];

const PREVIEWS: Array<{ id: SyncPreviewMode; label: string }> = [
  { id: 'sql', label: 'SQL' },
  { id: 'mig', label: '.mig' },
];

function Segment<T extends string>({
  items,
  active,
  onChange,
  nodeId,
}: {
  items: Array<{ id: T; label: string }>;
  active: T;
  onChange(id: T): void;
  nodeId?: string;
}) {
  return (
    <div
      data-node={nodeId}
      className="inline-flex items-center rounded-md border border-gray-200 dark:border-zinc-800 p-0.5"
    >
      {items.map((item) => (
        <button
          key={item.id}
          data-node={nodeId ? `${nodeId}/${item.id}` : undefined}
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            active === item.id
              ? 'bg-blue-500 text-white'
              : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ObjectRow({
  obj,
  checked,
  onToggle,
  renameChoice,
  onRenameChoice,
}: {
  obj: SyncObject;
  checked: boolean;
  onToggle(name: string, checked: boolean): void;
  renameChoice: RenameChoice;
  onRenameChoice(name: string, choice: RenameChoice): void;
}) {
  const meta = KIND_META[obj.kind];
  const Icon = meta.icon;
  return (
    <div
      data-node={`sync-object/${obj.name}`}
      className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-zinc-800/50"
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onToggle(obj.name, !!c)}
        className="size-3.5"
      />
      <span className={cn('flex w-4 shrink-0 justify-center font-mono text-xs font-bold', meta.tone)}>
        {meta.sign}
      </span>
      <Icon className={cn('size-3.5 shrink-0', meta.tone)} />
      <span className="truncate font-mono text-xs text-gray-800 dark:text-zinc-200">{obj.name}</span>
      {obj.detail && (
        <span className="truncate font-mono text-[11px] text-gray-500 dark:text-zinc-500">
          {obj.detail}
        </span>
      )}
      {obj.destructive && obj.kind !== 'rename' && (
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[10px] font-medium uppercase text-red-500 dark:text-red-400">
          <AlertTriangle className="size-3" />
          data loss
        </span>
      )}
      {obj.kind === 'rename' && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {(['rename', 'drop+add'] as RenameChoice[]).map((choice) => (
            <button
              key={choice}
              onClick={() => onRenameChoice(obj.name, choice)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                renameChoice === choice
                  ? 'bg-violet-500 text-white'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200',
              )}
            >
              {choice}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SyncPanel({
  direction,
  onDirectionChange,
  objects,
  checked,
  onToggle,
  renameChoices,
  onRenameChoice,
  previewMode,
  onPreviewModeChange,
  preview,
  applying,
  onApply,
}: SyncPanelProps) {
  const isChecked = useCallback(
    (obj: SyncObject) => checked?.[obj.name] ?? defaultChecked(obj),
    [checked],
  );
  const choiceOf = useCallback(
    (name: string): RenameChoice => renameChoices?.[name] ?? 'rename',
    [renameChoices],
  );

  const previewText = previewMode === 'sql' ? preview.sql : preview.mig;
  const selectedCount = objects.filter((o) => isChecked(o)).length;
  const destructiveSelected = objects.some((o) => o.destructive && o.kind !== 'rename' && isChecked(o));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 dark:border-zinc-800 px-3 py-2">
        <Segment
          items={DIRECTIONS}
          active={direction}
          onChange={onDirectionChange}
          nodeId="sync-direction"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 dark:text-zinc-500">
            {selectedCount}/{objects.length} selected
          </span>
          <Button
            data-node="sync-apply"
            size="xs"
            onClick={onApply}
            disabled={applying || selectedCount === 0}
            className={cn(
              'text-white',
              destructiveSelected ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {applying && <Loader2 className="size-3 animate-spin" />}
            Apply
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-0">
        <div className="min-h-0 overflow-auto border-r border-gray-200 dark:border-zinc-800 p-2">
          {objects.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-zinc-600">
              No differences
            </div>
          ) : (
            <div className="space-y-0.5">
              {objects.map((obj) => (
                <ObjectRow
                  key={obj.name}
                  obj={obj}
                  checked={isChecked(obj)}
                  onToggle={onToggle}
                  renameChoice={choiceOf(obj.name)}
                  onRenameChoice={onRenameChoice}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 dark:border-zinc-800 px-2 py-1.5">
            <Segment items={PREVIEWS} active={previewMode} onChange={onPreviewModeChange} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {previewText.trim() ? (
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-700 dark:text-zinc-300">
                <code>{previewText}</code>
              </pre>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-zinc-600">
                Nothing to apply
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
