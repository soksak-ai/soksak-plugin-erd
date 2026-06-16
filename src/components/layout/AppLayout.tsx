import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
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

  const [leftWidth, setLeftWidth] = useState(LEFT_SIDEBAR_SIZE_PX);
  const [rightWidth, setRightWidth] = useState(RIGHT_SIDEBAR_DEFAULT_PX);
  const [bottomHeight, setBottomHeight] = useState(BOTTOM_DEFAULT_PX);

  const handleMainChange = useCallback((sizes: number[]) => {
    if (leftSidebarOpen) {
      const v = Math.round(sizes[0] ?? leftWidth);
      setLeftWidth(Math.max(LEFT_SIDEBAR_SIZE_PX, v));
    }
    if (rightSidebarOpen) {
      const v = Math.round(sizes[2] ?? rightWidth);
      setRightWidth(Math.max(RIGHT_SIDEBAR_MIN_PX, v));
    }
  }, [leftSidebarOpen, rightSidebarOpen, leftWidth, rightWidth]);

  const handleVerticalChange = useCallback((sizes: number[]) => {
    if (!bottomPanelOpen) return;
    const nextBottom = Math.round(sizes[1] ?? bottomHeight);
    setBottomHeight(Math.max(BOTTOM_MIN_PX, nextBottom));
  }, [bottomPanelOpen, bottomHeight]);

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
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
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
