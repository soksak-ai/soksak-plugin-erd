import { useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ERDCanvas } from '@/components/canvas/ERDCanvas';
import { CreateTableDialog } from '@/components/dialogs/CreateTableDialog';
import { ImportSQLDialog } from '@/components/dialogs/ImportSQLDialog';
import { ImportMermaidDialog } from '@/components/dialogs/ImportMermaidDialog';
import { ImportMWBDialog } from '@/components/dialogs/ImportMWBDialog';
import { Toaster } from '@/components/Toaster';
import { CommandPalette } from '@/components/CommandPalette';
import { useHostThemeSync } from '@/hooks/useTheme';
import { resolveStoreMode } from '@/features/theme/host';
import { useStore } from '@/store';
import { PortalRootProvider } from '@/components/ui/portal-context';
import { DbHostProvider, type RawExec } from '@/components/host/db-host';
import { createConnectionsStore, type ConnectionsStore } from '@/plugin/connections';
import '@/lib/perf';
import '@/lib/benchmark';

interface AppProps {
  // 번들 플러그인(plugin-entry)에서 Shadow DOM 안 host 를 주입한다. Radix 포털 컨테이너 +
  // 다크모드 클래스 미러 타깃. 일반 웹(main.tsx)에서는 미지정(undefined) → document 기본 동작.
  portalRoot?: HTMLElement;
  // 코어 명령 브리지(app.commands.execute) + 접속 프로필 스토어 — plugin-entry 가 activate 에서
  // 주입한다. 일반 웹(main.tsx)에서는 미지정 → DB 패널은 빈 상태로 mount 된다.
  exec?: RawExec;
  connStore?: ConnectionsStore;
  // 이 canvas 인스턴스의 콘텐츠 뷰 id — 레일 브리지 키(사이드바 방출). null = 레일 없는
  // 호스트(일반 웹·구코어) → AppLayout 이 인라인 Allotment 사이드바로 폴백한다.
  viewId?: string | null;
}

function App({ portalRoot, exec, connStore, viewId = null }: AppProps) {
  // 호스트 테마 모드를 store.theme 로 반영(호스트 root 는 절대 건드리지 않는다).
  useHostThemeSync();

  // Shadow DOM 다크모드 — @custom-variant dark 가 :is(.dark *) 라 shadow 밖 documentElement 의
  // class 는 shadow 내부에서 안 보인다. 그래서 store.theme(=호스트 모드 미러)를 portalRoot
  // (=shadow host)에 light/dark 로 반영해 shadow 내부 트리의 dark: variant 가 해소되게 한다.
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    if (!portalRoot) return;
    portalRoot.classList.remove('light', 'dark');
    portalRoot.classList.add(resolveStoreMode(theme));
  }, [theme, portalRoot]);

  // Web dev path (main.tsx) provides no connStore — a throwaway empty store keeps the DB panels
  // mounting uniformly (they degrade to empty states when `exec` is absent).
  const store = useMemo(() => connStore ?? createConnectionsStore(), [connStore]);

  return (
    <PortalRootProvider value={portalRoot ?? null}>
      <DbHostProvider exec={exec} connStore={store}>
        {/* relative wrapper — 절대배치 Toaster 가 앱 콘텐츠 영역 우상단에 고정되게 한다. */}
        <div className="relative h-full w-full">
          <AppLayout canvas={<ERDCanvas />} viewId={viewId} />
          <CreateTableDialog />
          <ImportSQLDialog />
          <ImportMermaidDialog />
          <ImportMWBDialog />
          <Toaster />
          <CommandPalette />
        </div>
      </DbHostProvider>
    </PortalRootProvider>
  );
}

export default App;
