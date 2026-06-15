import type { ERDSchema } from '@/types/schema';

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
  table?: string;
}

export function validateSchema(schema: ERDSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tables = Object.values(schema.tables);
  const relationships = Object.values(schema.relationships);

  // Check for empty schema
  if (tables.length === 0) {
    issues.push({ level: 'info', message: 'No tables defined in the schema' });
    return issues;
  }

  // Check for duplicate table names
  const nameCount = new Map<string, number>();
  for (const table of tables) {
    nameCount.set(table.name, (nameCount.get(table.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      issues.push({ level: 'error', message: `Duplicate table name '${name}' (${count} occurrences)` });
    }
  }

  for (const table of tables) {
    // Tables with no columns
    if (table.columns.length === 0) {
      issues.push({
        level: 'error',
        message: `Table '${table.name}' has no columns`,
        table: table.name,
      });
    }

    // Tables with no primary key
    if (!table.columns.some((c) => c.isPrimaryKey)) {
      issues.push({
        level: 'warning',
        message: `Table '${table.name}' has no primary key`,
        table: table.name,
      });
    }

    // Check for duplicate column names within a table
    const colNameCount = new Map<string, number>();
    for (const col of table.columns) {
      colNameCount.set(col.name, (colNameCount.get(col.name) ?? 0) + 1);
    }
    for (const [name, count] of colNameCount) {
      if (count > 1) {
        issues.push({
          level: 'error',
          message: `Table '${table.name}' has duplicate column name '${name}'`,
          table: table.name,
        });
      }
    }
  }

  // Check for relationships referencing non-existent tables
  const tableIds = new Set(tables.map((t) => t.id));
  for (const rel of relationships) {
    if (!tableIds.has(rel.sourceTableId)) {
      issues.push({
        level: 'error',
        message: `Relationship '${rel.name ?? rel.id}' references non-existent source table`,
      });
    }
    if (!tableIds.has(rel.targetTableId)) {
      issues.push({
        level: 'error',
        message: `Relationship '${rel.name ?? rel.id}' references non-existent target table`,
      });
    }
  }

  // Detect circular FK references (simple cycle detection)
  const graph = new Map<string, Set<string>>();
  for (const table of tables) {
    graph.set(table.id, new Set());
  }
  for (const rel of relationships) {
    if (graph.has(rel.sourceTableId)) {
      graph.get(rel.sourceTableId)!.add(rel.targetTableId);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of graph.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const tableId of graph.keys()) {
    if (!visited.has(tableId) && hasCycle(tableId)) {
      issues.push({
        level: 'warning',
        message: 'Circular foreign key reference detected in the schema',
      });
      break;
    }
  }

  if (issues.length === 0) {
    issues.push({ level: 'info', message: 'No issues found' });
  }

  return issues;
}
