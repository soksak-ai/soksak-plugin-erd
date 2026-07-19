// Relationship optionality — derived from data, never asked. A relationship is optional on the
// "one" side when its referencing foreign-key column(s) are nullable: a child row may exist without
// a parent, so the parent participation is "zero or one" (○) rather than "exactly one" (|). The FK
// lives on the "many" side (the target for 1:N/1:1); N:M is a junction with no single FK and is
// never marked optional. Pure and Pixi-free so the rule is unit tested independently.

export interface OptionalityRel {
  type: string; // RelationType
  sourceColumnIds?: string[];
  targetColumnIds?: string[];
}

export interface NullableLookup {
  get(columnId: string): { nullable?: boolean } | undefined;
}

export function isRelationshipOptional(rel: OptionalityRel, columns: NullableLookup): boolean {
  if (rel.type === 'N:M') return false;
  const fkIds = rel.targetColumnIds ?? [];
  if (fkIds.length === 0) return false;
  // Optional only when every FK column is nullable (a partial-NOT-NULL FK is still mandatory).
  return fkIds.every((id) => columns.get(id)?.nullable === true);
}

// Build the id→column lookup the derivation needs from a tables map.
export function columnsById(
  tables: Record<string, { columns?: Array<{ id: string; nullable?: boolean }> }>,
): Map<string, { nullable?: boolean }> {
  const map = new Map<string, { nullable?: boolean }>();
  for (const t of Object.values(tables)) {
    for (const c of t.columns ?? []) map.set(c.id, c);
  }
  return map;
}
