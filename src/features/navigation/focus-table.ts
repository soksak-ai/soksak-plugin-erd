// Focus a table on the canvas — select it and pan the camera to its center.
// Single source for both the sidebar table list and the command palette so the
// two entry points never drift (select + pan geometry lives in one place).
import { useStore } from '@/store';
import { NODE_WIDTH, HEADER_HEIGHT, ROW_HEIGHT } from '@/components/canvas/pixi/constants';

export function focusTable(tableId: string): boolean {
  const state = useStore.getState();
  const table = state.tables[tableId];
  if (!table) return false;
  state.setSelectedNodeIds([tableId]);
  const pos = state.nodePositions[tableId];
  if (!pos) return true; // 선택은 됐으나 위치 미상(아직 배치 전) — 팬은 생략.
  const estimatedHeight = HEADER_HEIGHT + (table.columns?.length ?? 0) * ROW_HEIGHT;
  state.panToFn?.(pos.x + NODE_WIDTH / 2, pos.y + estimatedHeight / 2);
  return true;
}
