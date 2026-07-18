// notifications 커맨드 — GUI 액션 피드백(토스트) 로그를 헤드리스로 읽는 status 표면.
// GUI 없이도(에이전트/E2E) 마지막 사용자-대면 메시지들을 확인해 "무엇이 침묵하지 않았나"를 검증한다.
import { useToastStore } from '@/store/toast-store';

interface PluginContext {
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

export function registerNotificationCommands(ctx: PluginContext): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  ctx.subscriptions.push(
    register('notifications', {
      description: 'Return the recent action-feedback toast log (message, severity, seq)',
      triggers: { ko: '알림 토스트 피드백 로그 확인' },
      message: (d) => {
        const n = (d as { count?: number }).count ?? 0;
        return n > 0 ? `최근 알림 ${n}건` : '알림이 없습니다';
      },
      params: {
        limit: { type: 'number', description: 'Max entries (default 20)', required: false },
      },
      handler: async (p) => {
        const limit = Math.max(1, Math.min(50, ((p as { limit?: number })?.limit ?? 20) | 0));
        const log = useToastStore.getState().log.slice(0, limit);
        return {
          ok: true,
          count: log.length,
          active: useToastStore.getState().active.length,
          notifications: log.map((t) => ({ message: t.message, severity: t.severity, seq: t.seq })),
        };
      },
    }),
  );
}
