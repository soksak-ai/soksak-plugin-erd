// 접속 프로필 목록 섹션(plan §6-P1) — LeftSidebar 에 얹는 순수 표현 컴포넌트.
// 상태는 props(프로필·런타임 상태 맵·선택), 실제 명령 호출은 콜백으로 배선에 위임한다.
// 각 행: dialect 아이콘 · 이름 · 환경 배지 · read-only 실드 · 상태점. 헤더에 [+추가].
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionProfile } from '@/plugin/connections';
import {
  DialectIcon,
  EnvironmentBadge,
  ReadOnlyShield,
  StatusDot,
  type ConnectionRuntimeStatus,
} from '@/components/connections/dialect';

export interface ConnectionsPanelProps {
  profiles: ConnectionProfile[];
  // 프로필별 런타임 접속 상태(db-status 배선이 채운다). 없으면 disconnected 로 표시.
  statuses?: Record<string, ConnectionRuntimeStatus>;
  selectedId?: string | null;
  onAdd(): void;
  // 행 클릭 — 선택/편집 열기(배선이 결정). 미제공 시 행은 정적.
  onSelect?(id: string): void;
}

function subtitleFor(p: ConnectionProfile): string {
  if (p.dialect === 'sqlite') return p.file ?? 'no file';
  const host = p.host ?? 'localhost';
  const port = p.port != null ? `:${p.port}` : '';
  const db = p.database ? `/${p.database}` : '';
  return `${host}${port}${db}`;
}

export function ConnectionsPanel({
  profiles,
  statuses,
  selectedId,
  onAdd,
  onSelect,
}: ConnectionsPanelProps) {
  return (
    <div className="flex flex-col border-t border-gray-200 dark:border-zinc-800">
      {/* 헤더 + 추가 */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Connections
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-zinc-400">
            {profiles.length}
          </span>
          <button
            data-node="connection-add"
            onClick={onAdd}
            title="Add connection"
            className="inline-flex size-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="px-2 pb-2">
        {profiles.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-gray-400 dark:text-zinc-600">
            접속 프로필이 없습니다. <span className="font-semibold">+</span> 로 추가하세요.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {profiles.map((p) => {
              const status: ConnectionRuntimeStatus = statuses?.[p.id] ?? 'disconnected';
              const isSelected = selectedId === p.id;
              return (
                <li key={p.id}>
                  <button
                    data-node={`connection-item/${p.id}`}
                    onClick={onSelect ? () => onSelect(p.id) : undefined}
                    className={cn(
                      'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      onSelect && 'cursor-pointer',
                      isSelected
                        ? 'bg-blue-500/10'
                        : 'hover:bg-gray-100 dark:hover:bg-zinc-800',
                    )}
                  >
                    <DialectIcon dialect={p.dialect} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'truncate text-xs font-medium',
                            isSelected
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-800 dark:text-zinc-200',
                          )}
                        >
                          {p.name}
                        </span>
                        {p.readOnly && <ReadOnlyShield />}
                      </div>
                      <span className="block truncate text-[10px] text-gray-400 dark:text-zinc-500 font-mono">
                        {subtitleFor(p)}
                      </span>
                    </div>
                    <EnvironmentBadge environment={p.environment} />
                    <StatusDot status={status} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
