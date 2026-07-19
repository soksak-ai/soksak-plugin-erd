import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { Allotment, LayoutPriority } from 'allotment';
import { useStore } from '@/store';
import { Toolbar } from '@/components/toolbar/Toolbar';
import { LeftSidebar } from '@/components/sidebar/LeftSidebar';
import { RightSidebar } from '@/components/sidebar/RightSidebar';
import { BottomPanel } from '@/components/panels/BottomPanel';
import { StatusBar } from '@/components/layout/StatusBar';

interface AppLayoutProps {
  canvas: ReactNode;
}

const LEFT_SIDEBAR_SIZE_PX = 240;
const RIGHT_SIDEBAR_DEFAULT_PX = 320;
const RIGHT_SIDEBAR_MIN_PX = 240;
const MAIN_MIN_PX = 480;
const BOTTOM_DEFAULT_PX = 260;
const BOTTOM_MIN_PX = 140;

export function AppLayout({ canvas }: AppLayoutProps) {
  const leftSidebarOpen = useStore((s) => s.leftSidebarOpen);
  const rightSidebarOpen = useStore((s) => s.rightSidebarOpen);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  // 패널 크기는 store 소유 → prefs 문서로 세션 간 영속(AppLayout 로컬 state 아님).
  const leftWidth = useStore((s) => s.leftWidth);
  const rightWidth = useStore((s) => s.rightWidth);
  const bottomHeight = useStore((s) => s.bottomHeight);
  const setPanelSizes = useStore((s) => s.setPanelSizes);

  const handleMainChange = useCallback((sizes: number[]) => {
    const next: { leftWidth?: number; rightWidth?: number } = {};
    if (leftSidebarOpen && sizes[0] !== undefined) next.leftWidth = Math.max(LEFT_SIDEBAR_SIZE_PX, Math.round(sizes[0]));
    if (rightSidebarOpen && sizes[2] !== undefined) next.rightWidth = Math.max(RIGHT_SIDEBAR_MIN_PX, Math.round(sizes[2]));
    if (next.leftWidth !== undefined || next.rightWidth !== undefined) setPanelSizes(next);
  }, [leftSidebarOpen, rightSidebarOpen, setPanelSizes]);

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
        minSize={leftSidebarOpen ? LEFT_SIDEBAR_SIZE_PX : 0}
        maxSize={leftSidebarOpen ? undefined : 0}
        preferredSize={leftSidebarOpen ? leftWidth : 0}
      >
        {leftSidebarOpen ? <LeftSidebar /> : null}
      </Allotment.Pane>

      <Allotment.Pane minSize={MAIN_MIN_PX} priority={LayoutPriority.High}>
        {canvas}
      </Allotment.Pane>

      <Allotment.Pane
        minSize={rightSidebarOpen ? RIGHT_SIDEBAR_MIN_PX : 0}
        maxSize={rightSidebarOpen ? undefined : 0}
        preferredSize={rightSidebarOpen ? rightWidth : 0}
      >
        {rightSidebarOpen ? <RightSidebar /> : null}
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
    </div>
  );
}
