// Toast host — renders active toasts top-right over the workspace. Each toast is
// a data-node so its presence and dismissal are inspectable/injectable (C2 transparency).
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastSeverity } from '@/store/toast-store';
import { cn } from '@/lib/utils';

const ICON: Record<ToastSeverity, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

// 심각도별 좌측 강조선 + 아이콘 색(다크/라이트 공통 토큰).
const ACCENT: Record<ToastSeverity, string> = {
  info: 'border-l-blue-500 text-blue-400',
  success: 'border-l-emerald-500 text-emerald-400',
  warning: 'border-l-amber-500 text-amber-400',
  error: 'border-l-red-500 text-red-400',
};

export function Toaster() {
  const active = useToastStore((s) => s.active);
  const dismiss = useToastStore((s) => s.dismiss);
  if (active.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute right-3 top-3 z-[100] flex w-72 flex-col gap-2"
      data-node="toaster"
    >
      {active.map((t) => {
        const Icon = ICON[t.severity];
        return (
          <div
            key={t.id}
            data-node={`toast/${t.id}`}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border border-l-4 bg-white/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur',
              'border-gray-200 text-gray-800 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100',
              ACCENT[t.severity],
            )}
          >
            <Icon className={cn('mt-0.5 size-3.5 shrink-0', ACCENT[t.severity])} />
            <span className="min-w-0 flex-1 break-words">{t.message}</span>
            <button
              type="button"
              className="shrink-0 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              onClick={() => dismiss(t.id)}
              aria-label="dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
