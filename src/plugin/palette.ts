// palette 커맨드 — 명령 팔레트를 헤드리스로 열고/닫고 상태를 읽는다(투명성).
// GUI 없이도(에이전트/E2E) 팔레트 open 상태를 제어·관찰할 수 있게 한다.
import { usePaletteStore } from '@/features/palette/store';

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

export function registerPaletteCommands(ctx: PluginContext): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  ctx.subscriptions.push(
    register('palette', {
      description: 'Open, close, or toggle the command palette (open=true|false, omit to toggle)',
      triggers: { ko: '명령 팔레트 열기 닫기 토글' },
      message: (d) => ((d as { open?: boolean }).open ? '명령 팔레트를 열었습니다' : '명령 팔레트를 닫았습니다'),
      params: {
        open: { type: 'boolean', description: 'true=open, false=close, omit=toggle', required: false },
      },
      handler: async (p) => {
        const req = (p as { open?: boolean } | null)?.open;
        const store = usePaletteStore.getState();
        if (req === undefined) store.toggle();
        else store.setOpen(req);
        return { ok: true, open: usePaletteStore.getState().open };
      },
    }),
  );
}
