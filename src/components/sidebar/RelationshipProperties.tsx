import { useMemo } from 'react';
import { useStore } from '@/store';
import type { Relationship } from '@/types/schema';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RelationshipPropertiesProps {
  relationship: Relationship;
}

export function RelationshipProperties({ relationship }: RelationshipPropertiesProps) {
  const tables = useStore((s) => s.tables);
  const updateRelationship = useStore((s) => s.updateRelationship);

  const sourceTable = tables[relationship.sourceTableId];
  const targetTable = tables[relationship.targetTableId];

  const sourceColumnNames = useMemo(() => {
    if (!sourceTable) return [];
    const map = new Map(sourceTable.columns.map((c) => [c.id, c.name]));
    return relationship.sourceColumnIds.map((id) => map.get(id) ?? id);
  }, [sourceTable, relationship.sourceColumnIds]);

  const targetColumnNames = useMemo(() => {
    if (!targetTable) return [];
    const map = new Map(targetTable.columns.map((c) => [c.id, c.name]));
    return relationship.targetColumnIds.map((id) => map.get(id) ?? id);
  }, [targetTable, relationship.targetColumnIds]);

  const pairs = useMemo(() => {
    const len = Math.max(sourceColumnNames.length, targetColumnNames.length);
    const rows: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < len; i++) {
      rows.push({
        source: sourceColumnNames[i] ?? '-',
        target: targetColumnNames[i] ?? '-',
      });
    }
    return rows;
  }, [sourceColumnNames, targetColumnNames]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Relationship
        </span>
        <div className="rounded border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/40 p-2 text-xs">
          <p className="text-gray-500 dark:text-zinc-500">Table</p>
          <p className="mt-1 text-gray-700 dark:text-zinc-300 break-words">
            {sourceTable?.name ?? '?'} -&gt; {targetTable?.name ?? '?'}
          </p>
          <div className="mt-3 border-t border-gray-200 dark:border-zinc-800 pt-2">
            <p className="mb-1 text-gray-500 dark:text-zinc-500">Column Mapping</p>
            {pairs.length > 0 ? (
              <div className="space-y-1">
                {pairs.map((row, idx) => (
                  <p key={`${row.source}-${row.target}-${idx}`} className="text-gray-700 dark:text-zinc-300 break-words">
                    <span className="text-amber-500">{row.source}</span> (PK) -&gt; <span className="text-sky-400">{row.target}</span> (FK)
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-700 dark:text-zinc-300">-</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
          Constraint
        </span>
        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">Cardinality</label>
          <Select
            value={relationship.type}
            onValueChange={(value) => updateRelationship(relationship.id, { type: value as Relationship['type'] })}
          >
            <SelectTrigger size="sm" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="1:N">1:N</SelectItem>
              <SelectItem value="N:M">N:M</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">On Delete</label>
          <Select
            value={relationship.onDelete}
            onValueChange={(value) => updateRelationship(relationship.id, { onDelete: value as Relationship['onDelete'] })}
          >
            <SelectTrigger size="sm" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASCADE">CASCADE</SelectItem>
              <SelectItem value="SET NULL">SET NULL</SelectItem>
              <SelectItem value="RESTRICT">RESTRICT</SelectItem>
              <SelectItem value="NO ACTION">NO ACTION</SelectItem>
              <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 dark:text-zinc-500">On Update</label>
          <Select
            value={relationship.onUpdate}
            onValueChange={(value) => updateRelationship(relationship.id, { onUpdate: value as Relationship['onUpdate'] })}
          >
            <SelectTrigger size="sm" className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASCADE">CASCADE</SelectItem>
              <SelectItem value="SET NULL">SET NULL</SelectItem>
              <SelectItem value="RESTRICT">RESTRICT</SelectItem>
              <SelectItem value="NO ACTION">NO ACTION</SelectItem>
              <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

    </div>
  );
}
