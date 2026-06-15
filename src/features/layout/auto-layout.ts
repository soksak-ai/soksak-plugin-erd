import dagre from '@dagrejs/dagre';
import type { ERDSchema, Layer } from '@/types/schema';
import type { NodePosition } from '@/types/diagram';
import { generateId } from '@/lib/id';
import { groupTablesByPrefix } from './group-by-prefix';

export interface LayoutOptions {
  direction: 'TB' | 'LR' | 'RL' | 'BT';
  nodeWidth?: number;
  nodeHeight?: number;
  spacing?: { x: number; y: number };
}

export interface LayoutResult {
  positions: Record<string, NodePosition>;
  layers: Record<string, Layer>;
  tableLayerMap: Record<string, string>; // tableId -> layerId
}

export function computeAutoLayout(
  schema: ERDSchema,
  _currentPositions: Record<string, NodePosition>,
  options: LayoutOptions = { direction: 'TB' }
): Record<string, NodePosition> {
  // Simple layout for backward compatibility
  return computeGroupedLayout(schema, options).positions;
}

export function computeGroupedLayout(
  schema: ERDSchema,
  options: LayoutOptions = { direction: 'TB' }
): LayoutResult {
  const groups = groupTablesByPrefix(schema);
  const tables = schema.tables;
  const nodeWidth = options.nodeWidth ?? 240;

  if (groups.length <= 1) {
    // No meaningful groups - just do flat layout
    const positions = flatLayout(schema, options);
    return { positions, layers: {}, tableLayerMap: {} };
  }

  const allPositions: Record<string, NodePosition> = {};
  const layers: Record<string, Layer> = {};
  const tableLayerMap: Record<string, string> = {};

  // Calculate group columns - arrange groups in a grid
  const groupsPerRow = Math.ceil(Math.sqrt(groups.length));
  let groupX = 0;
  let groupY = 0;
  let maxHeightInRow = 0;
  const GROUP_PADDING = 60;
  const GROUP_GAP = 100;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    // Create sub-graph for this group
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: options.direction,
      nodesep: options.spacing?.x ?? 60,
      ranksep: options.spacing?.y ?? 80,
      marginx: GROUP_PADDING,
      marginy: GROUP_PADDING,
    });

    for (const tableId of group.tableIds) {
      const table = tables[tableId];
      if (!table) continue;
      const colCount = table.columns.length;
      const height = 32 + Math.min(colCount, 20) * 26 + 8;
      g.setNode(tableId, { width: nodeWidth, height });
    }

    // Add edges within this group only
    for (const rel of Object.values(schema.relationships)) {
      if (group.tableIds.includes(rel.sourceTableId) && group.tableIds.includes(rel.targetTableId)) {
        g.setEdge(rel.sourceTableId, rel.targetTableId);
      }
    }

    dagre.layout(g);

    // Calculate group bounds from node positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nodeId of g.nodes()) {
      const node = g.node(nodeId);
      if (!node) continue;
      const x = node.x - (node.width ?? nodeWidth) / 2;
      const y = node.y - (node.height ?? 200) / 2;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + (node.width ?? nodeWidth));
      maxY = Math.max(maxY, y + (node.height ?? 200));
    }

    // Handle empty groups
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = nodeWidth;
      maxY = 200;
    }

    const groupWidth = maxX - minX + GROUP_PADDING * 2;
    const groupHeight = maxY - minY + GROUP_PADDING * 2 + 30; // +30 for label

    // Position nodes relative to the group position in the grid
    for (const nodeId of g.nodes()) {
      const node = g.node(nodeId);
      if (!node) continue;
      allPositions[nodeId] = {
        x: groupX + (node.x - (node.width ?? nodeWidth) / 2 - minX) + GROUP_PADDING,
        y: groupY + (node.y - (node.height ?? 200) / 2 - minY) + GROUP_PADDING + 30,
      };
    }

    // Create layer
    const layerId = generateId();
    layers[layerId] = {
      id: layerId,
      name: group.label,
      color: group.color,
      bounds: {
        x: groupX,
        y: groupY,
        w: groupWidth,
        h: groupHeight,
      },
    };

    for (const tableId of group.tableIds) {
      tableLayerMap[tableId] = layerId;
    }

    // Advance grid position
    maxHeightInRow = Math.max(maxHeightInRow, groupHeight);
    if ((i + 1) % groupsPerRow === 0) {
      groupX = 0;
      groupY += maxHeightInRow + GROUP_GAP;
      maxHeightInRow = 0;
    } else {
      groupX += groupWidth + GROUP_GAP;
    }
  }

  return { positions: allPositions, layers, tableLayerMap };
}

function flatLayout(
  schema: ERDSchema,
  options: LayoutOptions
): Record<string, NodePosition> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.spacing?.x ?? 80,
    ranksep: options.spacing?.y ?? 120,
    marginx: 50,
    marginy: 50,
  });

  for (const table of Object.values(schema.tables)) {
    const colCount = table.columns.length;
    const height = 32 + colCount * 26 + 8;
    g.setNode(table.id, {
      width: options.nodeWidth ?? 240,
      height,
    });
  }

  for (const rel of Object.values(schema.relationships)) {
    g.setEdge(rel.sourceTableId, rel.targetTableId);
  }

  dagre.layout(g);

  const positions: Record<string, NodePosition> = {};
  for (const nodeId of g.nodes()) {
    const node = g.node(nodeId);
    if (node) {
      positions[nodeId] = {
        x: node.x - (node.width ?? 240) / 2,
        y: node.y - (node.height ?? 200) / 2,
      };
    }
  }

  return positions;
}
