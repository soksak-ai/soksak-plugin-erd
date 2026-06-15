import { useStore } from '@/store';

export function StatusBar() {
  const dialect = useStore((s) => s.dialect);
  const zoom = useStore((s) => s.viewport.zoom);
  const tables = useStore((s) => s.tables);
  const relationships = useStore((s) => s.relationships);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useStore((s) => s.selectedEdgeIds);
  const autoLayoutRunning = useStore((s) => s.autoLayoutRunning);

  const tableCount = Object.keys(tables).length;
  const relCount = Object.keys(relationships).length;
  const zoomPct = Math.round(zoom * 100);
  const dialectLabel = dialect === 'mysql' ? 'MYSQL v8.0' : 'POSTGRESQL v15.4';

  let selectionInfo = 'No selection';
  if (selectedNodeIds.length === 1) {
    const table = tables[selectedNodeIds[0]];
    if (table) selectionInfo = `Table: ${table.name} (${table.columns.length} columns)`;
  } else if (selectedNodeIds.length > 1) {
    selectionInfo = `${selectedNodeIds.length} tables selected`;
  } else if (selectedEdgeIds.length === 1) {
    const rel = relationships[selectedEdgeIds[0]];
    if (rel) {
      const srcTable = tables[rel.sourceTableId];
      const tgtTable = tables[rel.targetTableId];
      selectionInfo = `Relation: ${srcTable?.name ?? '?'} -> ${tgtTable?.name ?? '?'} (${rel.type})`;
    }
  } else if (selectedEdgeIds.length > 1) {
    selectionInfo = `${selectedEdgeIds.length} relations selected`;
  }

  return (
    <div className="flex h-6 shrink-0 items-center justify-between bg-blue-500 px-3 text-white">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase">{dialectLabel}</span>
        <span className="text-[10px] font-medium opacity-70">{selectionInfo}</span>
      </div>
      <div className="flex items-center gap-3">
        {autoLayoutRunning && (
          <span className="text-[10px] font-semibold uppercase tracking-wide">Auto Layout Running...</span>
        )}
        <span className="text-[10px] font-medium">{zoomPct}%</span>
        <span className="text-[10px] font-medium">{tableCount} tables</span>
        <span className="text-[10px] font-medium">{relCount} relations</span>
      </div>
    </div>
  );
}
