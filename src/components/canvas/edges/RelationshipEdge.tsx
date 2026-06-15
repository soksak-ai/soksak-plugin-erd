import { type FC } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { RelationType } from '@/types/schema';
import { getMarkerIds } from './markers';

export const RelationshipEdge: FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const relType = (data?.type as RelationType) ?? '1:N';
  const { sourceMarker, targetMarker } = getMarkerIds(relType);

  // Non-identifying (dashed) by default
  const strokeDasharray = '6 3';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : '#52525b',
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray,
        }}
        markerStart={`url(#${sourceMarker})`}
        markerEnd={`url(#${targetMarker})`}
      />
      {selected && data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            startOffset="50%"
            textAnchor="middle"
            className="fill-blue-400 text-[10px]"
          >
            {data.label as string}
          </textPath>
        </text>
      )}
    </>
  );
};
