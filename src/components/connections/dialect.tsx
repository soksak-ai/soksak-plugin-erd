// 접속 UI 공유 표현 primitive — dialect 아이콘·환경 배지·상태점·read-only 실드. 순수 표현.
// 색은 테마 토큰/tailwind 유틸만 쓴다(하드코딩 hex 금지). connections/ 안 두 화면(패널·다이얼로그)이 공유.
import * as React from 'react';
import { Database, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionDialect, ConnectionEnvironment } from '@/plugin/connections';

// dialect → 모노그램 글자. 아이콘은 Database + dialect 톤.
const DIALECT_MONOGRAM: Record<ConnectionDialect, string> = {
  sqlite: 'S',
  mysql: 'M',
  postgresql: 'P',
};

const DIALECT_TONE: Record<ConnectionDialect, string> = {
  sqlite: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  mysql: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  postgresql: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
};

export function DialectIcon({ dialect, className }: { dialect: ConnectionDialect; className?: string }) {
  return (
    <span
      className={cn(
        'relative inline-flex size-6 shrink-0 items-center justify-center rounded-md',
        DIALECT_TONE[dialect],
        className,
      )}
      title={dialect}
      aria-label={dialect}
    >
      <Database className="size-3 opacity-40" />
      <span className="absolute text-[9px] font-bold leading-none">{DIALECT_MONOGRAM[dialect]}</span>
    </span>
  );
}

// dev 회색 / staging 황 / prod 적. 배경/텍스트 모두 라이트·다크 대응.
const ENV_TONE: Record<ConnectionEnvironment, string> = {
  dev: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  staging: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  prod: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};

const ENV_LABEL: Record<ConnectionEnvironment, string> = {
  dev: 'DEV',
  staging: 'STAGING',
  prod: 'PROD',
};

export function EnvironmentBadge({
  environment,
  className,
  ...rest
}: { environment: ConnectionEnvironment; className?: string } & React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        ENV_TONE[environment],
        className,
      )}
      {...rest}
    >
      {ENV_LABEL[environment]}
    </span>
  );
}

// read-only 실드 — 자물쇠. read-only 아닐 땐 렌더 안 함(호출부에서 조건).
export function ReadOnlyShield({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400', className)}
      title="read-only"
    >
      <Lock className="size-3" />
    </span>
  );
}

export type ConnectionRuntimeStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

const STATUS_TONE: Record<ConnectionRuntimeStatus, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-gray-300 dark:bg-zinc-600',
  error: 'bg-red-500',
};

const STATUS_TITLE: Record<ConnectionRuntimeStatus, string> = {
  connected: 'connected',
  connecting: 'connecting…',
  disconnected: 'disconnected',
  error: 'error',
};

export function StatusDot({
  status,
  className,
}: {
  status: ConnectionRuntimeStatus;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_TONE[status], className)}
      title={STATUS_TITLE[status]}
      aria-label={STATUS_TITLE[status]}
    />
  );
}
