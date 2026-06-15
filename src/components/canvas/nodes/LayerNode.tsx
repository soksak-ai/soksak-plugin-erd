import { memo, type FC } from 'react';
import { type NodeProps } from '@xyflow/react';

interface LayerNodeData extends Record<string, unknown> {
  label: string;
  color: string;
  width: number;
  height: number;
}

const LayerNodeComponent: FC<NodeProps> = ({ data }) => {
  const { label, color, width, height } = data as LayerNodeData;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: `${color}08`,
        border: `1px dashed ${color}40`,
        borderRadius: 12,
      }}
      className="pointer-events-none"
    >
      <div
        className="absolute left-3 top-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: `${color}90` }}
      >
        {label}
      </div>
    </div>
  );
};

export const LayerNode = memo(LayerNodeComponent);
