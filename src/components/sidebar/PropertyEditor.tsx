import { useDeferredValue, useMemo } from 'react';
import { useStore } from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TableProperties } from '@/components/sidebar/TableProperties';
import { RelationshipProperties } from '@/components/sidebar/RelationshipProperties';

export function PropertyEditor() {
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useStore((s) => s.selectedEdgeIds);
  const tables = useStore((s) => s.tables);
  const relationships = useStore((s) => s.relationships);
  const deferredSelectedNodeIds = useDeferredValue(selectedNodeIds);
  const deferredSelectedEdgeIds = useDeferredValue(selectedEdgeIds);

  const selectedTable = useMemo(
    () => (deferredSelectedNodeIds.length === 1 ? tables[deferredSelectedNodeIds[0]] : null),
    [deferredSelectedNodeIds, tables],
  );
  const selectedRelationship = useMemo(
    () => (deferredSelectedEdgeIds.length === 1 ? relationships[deferredSelectedEdgeIds[0]] : null),
    [deferredSelectedEdgeIds, relationships],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Property Editor
        </span>
      </div>

      {selectedTable ? (
        <ScrollArea className="flex-1">
          <TableProperties table={selectedTable} />
        </ScrollArea>
      ) : selectedRelationship ? (
        <ScrollArea className="flex-1">
          <RelationshipProperties relationship={selectedRelationship} />
        </ScrollArea>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-gray-500 dark:text-zinc-500 text-center">
            Select a table or relationship
          </p>
        </div>
      )}
    </div>
  );
}
