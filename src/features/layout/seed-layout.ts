import type { NodePosition } from '@/types/diagram';

interface SeedLayoutOptions {
  startX?: number;
  startY?: number;
  nodeWidth?: number;
  rowHeight?: number;
  colGap?: number;
  rowGap?: number;
  groupGapX?: number;
  groupGapY?: number;
  groupPadding?: number;
}

export interface SeedTable {
  id: string;
  name: string;
  columnCount?: number;
}

export interface LayoutCenterOptions {
  nodeWidth?: number;
  rowHeight?: number;
}

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_ROW_HEIGHT = 220;
const DEFAULT_COL_GAP = 60;
const DEFAULT_ROW_GAP = 36;
const DEFAULT_GROUP_GAP_X = 120;
const DEFAULT_GROUP_GAP_Y = 120;
const DEFAULT_GROUP_PADDING = 24;
const APPROX_HEADER_HEIGHT = 32;
const APPROX_ROW_HEIGHT = 24;

export function computeSeedLayout(
  tables: SeedTable[],
  options: SeedLayoutOptions = {},
): Record<string, NodePosition> {
  const startX = options.startX ?? 0;
  const startY = options.startY ?? 0;
  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const colGap = options.colGap ?? DEFAULT_COL_GAP;
  const rowGap = options.rowGap ?? DEFAULT_ROW_GAP;
  const groupGapX = options.groupGapX ?? DEFAULT_GROUP_GAP_X;
  const groupGapY = options.groupGapY ?? DEFAULT_GROUP_GAP_Y;
  const groupPadding = options.groupPadding ?? DEFAULT_GROUP_PADDING;

  const count = tables.length;
  if (count === 0) return {};

  const groups = new Map<string, SeedTable[]>();
  for (const table of tables) {
    const key = getPrefixKey(table.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(table);
  }

  const sortedGroups = Array.from(groups.entries())
    .map(([prefix, items]) => ({
      prefix,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.prefix.localeCompare(b.prefix);
    });

  const groupsPerRow = Math.max(1, Math.ceil(Math.sqrt(sortedGroups.length)));
  const positions: Record<string, NodePosition> = {};
  let groupX = startX;
  let groupY = startY;
  let maxGroupHeightInRow = 0;

  for (let gi = 0; gi < sortedGroups.length; gi++) {
    const group = sortedGroups[gi];
    const groupCount = group.items.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(groupCount)));
    const rows = Math.ceil(groupCount / cols);
    const rowHeights = new Array<number>(rows).fill(0);

    for (let i = 0; i < groupCount; i++) {
      const table = group.items[i];
      const row = Math.floor(i / cols);
      const estimatedHeight = estimateTableHeight(table, rowHeight);
      rowHeights[row] = Math.max(rowHeights[row], estimatedHeight);
    }

    const rowOffsets = new Array<number>(rows).fill(0);
    for (let r = 1; r < rows; r++) {
      rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + rowGap;
    }

    for (let i = 0; i < groupCount; i++) {
      const table = group.items[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[table.id] = {
        x: groupX + groupPadding + col * (nodeWidth + colGap),
        y: groupY + groupPadding + rowOffsets[row],
      };
    }

    const groupWidth = groupPadding * 2 + cols * nodeWidth + (cols - 1) * colGap;
    const allRowsHeight = rowHeights.reduce((acc, h) => acc + h, 0);
    const groupHeight = groupPadding * 2 + allRowsHeight + Math.max(0, rows - 1) * rowGap;
    maxGroupHeightInRow = Math.max(maxGroupHeightInRow, groupHeight);

    if ((gi + 1) % groupsPerRow === 0) {
      groupX = startX;
      groupY += maxGroupHeightInRow + groupGapY;
      maxGroupHeightInRow = 0;
    } else {
      groupX += groupWidth + groupGapX;
    }
  }

  return positions;
}

function estimateTableHeight(table: SeedTable, fallbackRowHeight: number): number {
  if (typeof table.columnCount === 'number' && table.columnCount >= 0) {
    return Math.max(fallbackRowHeight, APPROX_HEADER_HEIGHT + table.columnCount * APPROX_ROW_HEIGHT);
  }
  return fallbackRowHeight;
}

export function computeLayoutCenter(
  positions: Record<string, NodePosition>,
  options: LayoutCenterOptions = {},
): { x: number; y: number } | null {
  const ids = Object.keys(positions);
  if (ids.length === 0) return null;

  const nodeWidth = options.nodeWidth ?? DEFAULT_NODE_WIDTH;
  const rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const pos = positions[id];
    if (!pos) continue;
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x + nodeWidth > maxX) maxX = pos.x + nodeWidth;
    if (pos.y + rowHeight > maxY) maxY = pos.y + rowHeight;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function getPrefixKey(name: string): string {
  const normalized = (name || '').trim().toLowerCase();
  if (!normalized) return '_misc';
  const token = normalized.split(/[_\-.]/)[0];
  return token || '_misc';
}
