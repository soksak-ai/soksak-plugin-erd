import type { ERDSchema } from '@/types/schema';

export interface TableGroup {
  prefix: string;
  label: string;
  tableIds: string[];
  color: string;
}

const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0891b2', '#a855f7', '#d946ef',
];

export function groupTablesByPrefix(schema: ERDSchema): TableGroup[] {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return [];

  // Extract prefix from table name: "film_category" -> "film", "customer" -> "customer"
  const prefixMap = new Map<string, string[]>();

  for (const table of tables) {
    const parts = table.name.split('_');
    // Use first segment as prefix, but only if there are multiple segments
    const prefix = parts.length > 1 ? parts[0] : table.name;
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(table.id);
  }

  // Merge single-table groups into an "Other" group
  const groups: TableGroup[] = [];
  const otherTableIds: string[] = [];
  let colorIdx = 0;

  for (const [prefix, tableIds] of prefixMap) {
    if (tableIds.length >= 2) {
      groups.push({
        prefix,
        label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        tableIds,
        color: GROUP_COLORS[colorIdx % GROUP_COLORS.length],
      });
      colorIdx++;
    } else {
      otherTableIds.push(...tableIds);
    }
  }

  // If there are ungrouped tables, add them as "Other" group
  if (otherTableIds.length > 0) {
    groups.push({
      prefix: '_other',
      label: 'Other',
      tableIds: otherTableIds,
      color: '#71717a',
    });
  }

  return groups;
}
