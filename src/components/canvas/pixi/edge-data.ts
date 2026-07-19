// Pure edge-data projection: relationships + selection → EdgeData[].
// Extracted so the selection-propagation rules (selected edge, related-to-selected-
// node) are unit-testable independent of Pixi. A `related` edge is one whose source
// or target table is currently node-selected — selecting a table emphasizes every
// edge that touches it.
import type { EdgeData } from './edge-renderer';
import type { AnchorSide } from '@/types/schema';
import { isRelationshipOptional, type NullableLookup } from '@/features/relationship/optionality';

export interface RelationshipLike {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  type: string;
  lineStyle?: 'dashed' | 'solid';
  sourceColumnIds?: string[];
  targetColumnIds?: string[];
  sourceAnchor?: { side: AnchorSide; offset: number };
  targetAnchor?: { side: AnchorSide; offset: number };
  bendPoints?: Array<{ x: number; y: number }>;
}

// An empty lookup keeps optionality derivation off (all mandatory) — used by call sites/tests that
// don't have column nullability at hand. The live canvas passes columnsById(tables).
const NO_COLUMNS: NullableLookup = { get: () => undefined };

export function buildEdgeData(
  relationships: Record<string, RelationshipLike>,
  selectedEdgeIds: string[],
  selectedNodeIds: string[] = [],
  columns: NullableLookup = NO_COLUMNS,
): EdgeData[] {
  const selectedEdges = new Set(selectedEdgeIds);
  const selectedNodes = new Set(selectedNodeIds);
  return Object.values(relationships).map((r) => ({
    // Legacy/accidental single-bend routes produce harsh V-shapes.
    // Keep bends only when there are 2+ points or custom anchors exist.
    bendPoints:
      (r.bendPoints?.length ?? 0) >= 2 || r.sourceAnchor || r.targetAnchor
        ? r.bendPoints
        : undefined,
    id: r.id,
    sourceId: r.sourceTableId,
    targetId: r.targetTableId,
    type: r.type as EdgeData['type'],
    optional: isRelationshipOptional(r, columns),
    selected: selectedEdges.has(r.id),
    // 직접 선택되지 않았어도 선택된 테이블에 연결된 엣지는 related 로 강조한다.
    related: selectedNodes.has(r.sourceTableId) || selectedNodes.has(r.targetTableId),
    lineStyle: r.lineStyle,
    sourceAnchor: r.sourceAnchor,
    targetAnchor: r.targetAnchor,
  }));
}
