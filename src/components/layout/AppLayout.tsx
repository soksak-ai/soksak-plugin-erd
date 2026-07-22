import type { ReactNode } from 'react';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Allotment, LayoutPriority } from 'allotment';
import { useStore } from '@/store';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebar } from '@/components/sidebar/RightSidebar';
import { BottomPanel } from '@/components/panels/BottomPanel';
import { StatusBar } from '@/components/layout/StatusBar';
import { railContainer, subscribeRail } from '@/plugin/railBridge';
import { resolveStoreMode } from '@/features/theme/host';

interface AppLayoutProps {
  canvas: ReactNode;
  // This canvas instance's content view id — the rail-bridge key. When a rail container is
  // registered for it, the matching inline pane collapses and the panel renders through a
  // React portal into the rail. null / no container = inline Allotment fallback.
  viewId?: string | null;
}

const LEFT_SIDEBAR_SIZE_PX = 240;
const RIGHT_SIDEBAR_DEFAULT_PX = 320;
const RIGHT_SIDEBAR_MIN_PX = 240;
const MAIN_MIN_PX = 480;
const BOTTOM_DEFAULT_PX = 260;
const BOTTOM_MIN_PX = 140;

export function AppLayout({ canvas, viewId = null }: AppLayoutProps) {
  const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useStore((s) => s.rightSidebarOpen);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  // 패널 크기는 store 소유 → prefs 문서로 세션 간 영속(AppLayout 로컬 state 아님).
  const leftWidth = useStore((s) => s.leftWidth);
  const rightWidth = useStore((s) => s.rightWidth);
  const bottomHeight = useStore((s) => s.bottomHeight);
  const setPanelSizes = useStore((s) => s.setPanelSizes);

  // Ejected sidebars (rail projection) — the rail views register bare containers keyed by
  // the bound view id; state stays here and only rendering leaves through portals.
  const railNav = useSyncExternalStore(
    (fn) => subscribeRail(viewId, fn),
    () => railContainer(viewId, 'navigator'),
  );
  const railProps = useSyncExternalStore(
    (fn) => subscribeRail(viewId, fn),
    () => railContainer(viewId, 'properties'),
  );

  // Rail containers live in their own shadow roots, outside the canvas shadow host that App
  // stamps — mirror the effective mode so Tailwind `dark:` variants resolve inside them.
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    for (const el of [railNav, railProps]) {
      if (!el) continue;
      el.classList.remove('light', 'dark');
      el.classList.add(resolveStoreMode(theme));
    }
  }, [theme, railNav, railProps]);

  // Inline pane visibility: closed by pref, or ejected to a rail (collapse via the same
  // width-0 mechanism as a closed sidebar — pane indices stay stable for onChange).
  // 사이드바는 레일 투영으로만 그린다(투영 공리) — 레일 부재 시 내부 인라인 폴백은 없다.
  const leftInline = false;
  const rightInline = false;

  const handleMainChange = useCallback((sizes: number[]) => {
    const next: { leftWidth?: number; rightWidth?: number } = {};
    if (leftInline && sizes[0] !== undefined) next.leftWidth = Math.max(LEFT_SIDEBAR_SIZE_PX, Math.round(sizes[0]));
    if (rightInline && sizes[2] !== undefined) next.rightWidth = Math.max(RIGHT_SIDEBAR_MIN_PX, Math.round(sizes[2]));
    if (next.leftWidth !== undefined || next.rightWidth !== undefined) setPanelSizes(next);
  }, [leftInline, rightInline, setPanelSizes]);

  const handleVerticalChange = useCallback((sizes: number[]) => {
    if (!bottomPanelOpen || sizes[1] === undefined) return;
    setPanelSizes({ bottomHeight: Math.max(BOTTOM_MIN_PX, Math.round(sizes[1])) });
  }, [bottomPanelOpen, setPanelSizes]);

  const mainSplit = (
    <Allotment
      proportionalLayout={false}
      separator={true}
      onChange={handleMainChange}
      className="h-full w-full"
    >
      <Allotment.Pane
        minSize={leftInline ? LEFT_SIDEBAR_SIZE_PX : 0}
        maxSize={leftInline ? undefined : 0}
        preferredSize={leftInline ? leftWidth : 0}
      >
        {leftInline ? <LeftSidebar /> : null}
      </Allotment.Pane>

      <Allotment.Pane minSize={MAIN_MIN_PX} priority={LayoutPriority.High}>
        {canvas}
      </Allotment.Pane>

      <Allotment.Pane
        minSize={rightInline ? RIGHT_SIDEBAR_MIN_PX : 0}
        maxSize={rightInline ? undefined : 0}
        preferredSize={rightInline ? rightWidth : 0}
      >
        {rightInline ? <RightSidebar /> : null}
      </Allotment.Pane>
    </Allotment>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
      <Toolbar />

      <div className="flex-1">
        <Allotment
          vertical
          proportionalLayout={false}
          separator={true}
          onChange={handleVerticalChange}
          className="h-full w-full"
        >
          <Allotment.Pane minSize={320} priority={LayoutPriority.High}>
            {mainSplit}
          </Allotment.Pane>
          <Allotment.Pane
            minSize={bottomPanelOpen ? BOTTOM_MIN_PX : 0}
            maxSize={bottomPanelOpen ? undefined : 0}
            preferredSize={bottomPanelOpen ? bottomHeight : 0}
          >
            {bottomPanelOpen ? <BottomPanel /> : null}
          </Allotment.Pane>
        </Allotment>
      </div>

      <StatusBar />

      {railNav ? createPortal(<LeftSidebar />, railNav) : null}
      {railProps ? createPortal(<RightSidebar />, railProps) : null}
    </div>
  );
}
