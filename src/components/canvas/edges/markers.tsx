import type { RelationType } from '@/types/schema';

export function MarkerDefinitions() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        {/* One marker: vertical bar */}
        <marker
          id="erd-one"
          viewBox="0 0 10 20"
          refX={10}
          refY={10}
          markerWidth={10}
          markerHeight={20}
          orient="auto-start-reverse"
        >
          <line x1={10} y1={0} x2={10} y2={20} stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Many marker: crow's foot (3 lines) */}
        <marker
          id="erd-many"
          viewBox="0 0 16 20"
          refX={16}
          refY={10}
          markerWidth={16}
          markerHeight={20}
          orient="auto-start-reverse"
        >
          <line x1={0} y1={10} x2={16} y2={0} stroke="currentColor" strokeWidth={1.5} />
          <line x1={0} y1={10} x2={16} y2={10} stroke="currentColor" strokeWidth={1.5} />
          <line x1={0} y1={10} x2={16} y2={20} stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Optional (zero) marker: small circle */}
        <marker
          id="erd-optional"
          viewBox="0 0 12 12"
          refX={6}
          refY={6}
          markerWidth={12}
          markerHeight={12}
          orient="auto-start-reverse"
        >
          <circle cx={6} cy={6} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* One-mandatory: double vertical bar */}
        <marker
          id="erd-one-mandatory"
          viewBox="0 0 14 20"
          refX={14}
          refY={10}
          markerWidth={14}
          markerHeight={20}
          orient="auto-start-reverse"
        >
          <line x1={8} y1={0} x2={8} y2={20} stroke="currentColor" strokeWidth={1.5} />
          <line x1={14} y1={0} x2={14} y2={20} stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Many-optional: circle + crow's foot */}
        <marker
          id="erd-many-optional"
          viewBox="0 0 28 20"
          refX={28}
          refY={10}
          markerWidth={28}
          markerHeight={20}
          orient="auto-start-reverse"
        >
          <circle cx={6} cy={10} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <line x1={12} y1={10} x2={28} y2={0} stroke="currentColor" strokeWidth={1.5} />
          <line x1={12} y1={10} x2={28} y2={10} stroke="currentColor" strokeWidth={1.5} />
          <line x1={12} y1={10} x2={28} y2={20} stroke="currentColor" strokeWidth={1.5} />
        </marker>
      </defs>
    </svg>
  );
}

export function getMarkerIds(relType: RelationType): {
  sourceMarker: string;
  targetMarker: string;
} {
  switch (relType) {
    case '1:1':
      return { sourceMarker: 'erd-one-mandatory', targetMarker: 'erd-one-mandatory' };
    case '1:N':
      return { sourceMarker: 'erd-one-mandatory', targetMarker: 'erd-many-optional' };
    case 'N:M':
      return { sourceMarker: 'erd-many-optional', targetMarker: 'erd-many-optional' };
  }
}
