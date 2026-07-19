import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ERDCanvas } from '@/components/canvas/ERDCanvas';
import { CreateTableDialog } from '@/components/dialogs/CreateTableDialog';
import { ImportSQLDialog } from '@/components/dialogs/ImportSQLDialog';
import { ImportMermaidDialog } from '@/components/dialogs/ImportMermaidDialog';
import { ImportMWBDialog } from '@/components/dialogs/ImportMWBDialog';
import { Toaster } from '@/components/Toaster';
import { CommandPalette } from '@/components/CommandPalette';
import { useHostThemeSync } from '@/hooks/useTheme';
import { useStore } from '@/store';
import { PortalRootProvider } from '@/components/ui/portal-context';
import '@/lib/perf';
import '@/lib/benchmark';

interface AppProps {
  // 번들 플러그인(plugin-entry)에서 Shadow DOM 안 host 를 주입한다. Radix 포털 컨테이너 +
  // 다크모드 클래스 미러 타깃. 일반 웹(main.tsx)에서는 미지정(undefined) → document 기본 동작.
  portalRoot?: HTMLElement;
}

function App({ portalRoot }: AppProps) {
  // 호스트 테마 모드를 store.theme 로 반영(호스트 root 는 절대 건드리지 않는다).
  useHostThemeSync();

  // Shadow DOM 다크모드 — @custom-variant dark 가 :is(.dark *) 라 shadow 밖 documentElement 의
  // class 는 shadow 내부에서 안 보인다. 그래서 store.theme(=호스트 모드 미러)를 portalRoot
  // (=shadow host)에 light/dark 로 반영해 shadow 내부 트리의 dark: variant 가 해소되게 한다.
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    if (!portalRoot) return;
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    portalRoot.classList.remove('light', 'dark');
    portalRoot.classList.add(resolved);
  }, [theme, portalRoot]);

  return (
    <PortalRootProvider value={portalRoot ?? null}>
      {/* relative wrapper — 절대배치 Toaster 가 앱 콘텐츠 영역 우상단에 고정되게 한다. */}
      <div className="relative h-full w-full">
        <AppLayout canvas={<ERDCanvas />} />
        <CreateTableDialog />
        <ImportSQLDialog />
        <ImportMermaidDialog />
        <ImportMWBDialog />
        <Toaster />
        <CommandPalette />
      </div>
    </PortalRootProvider>
  );
}

export default App;
