import type { ERDSchema, Table, Column, ReferentialAction } from '@/types/schema';
import { generateId } from '@/lib/id';

interface FKDef {
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  constraintName?: string;
}

export function parseCreateTables(sql: string): ERDSchema {
  const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };

  // Remove comments
  const cleaned = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Find CREATE TABLE statements using parentheses-aware extraction
  const statements = extractCreateTableStatements(cleaned);

  for (const stmt of statements) {
    const id = generateId();
    const table: Table = {
      id,
      name: stmt.tableName,
      schema: stmt.schema || undefined,
      columns: [],
      indexes: [],
    };

    const fks: FKDef[] = [];
    const pkColumns: string[] = [];

    // Split body by commas, but respect parentheses
    const parts = splitByComma(stmt.body);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // PRIMARY KEY constraint (table-level)
      const pkMatch = trimmed.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
        pkColumns.push(...cols);
        continue;
      }

      // UNIQUE constraint (table-level)
      const uniqueMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+`?\w+`?\s+)?UNIQUE\s+(?:KEY\s+)?(?:`?\w+`?\s+)?\(([^)]+)\)/i);
      if (uniqueMatch) {
        continue;
      }

      // INDEX/KEY (skip)
      if (/^\s*(?:INDEX|KEY)\s/i.test(trimmed)) continue;

      // FOREIGN KEY constraint
      const fkMatch = trimmed.match(
        /^\s*(?:CONSTRAINT\s+`?(\w+)`?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+`?(\w+)`?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/i
      );
      if (fkMatch) {
        fks.push({
          constraintName: fkMatch[1],
          columns: fkMatch[2].split(',').map(c => c.trim().replace(/`/g, '')),
          refTable: fkMatch[3],
          refColumns: fkMatch[4].split(',').map(c => c.trim().replace(/`/g, '')),
          onDelete: parseRefAction(fkMatch[5]),
          onUpdate: parseRefAction(fkMatch[6]),
        });
        continue;
      }

      // Column definition
      const colMatch = trimmed.match(
        /^\s*`?(\w+)`?\s+(\w+(?:\s*\([^)]*\))?(?:\s+(?:UNSIGNED|SIGNED|ZEROFILL))*)/i
      );
      if (colMatch) {
        const colName = colMatch[1];
        const dataType = colMatch[2].toUpperCase();
        const rest = trimmed.slice(colMatch[0].length).toUpperCase();

        const col: Column = {
          id: generateId(),
          name: colName,
          dataType: normalizeDataType(dataType),
          nullable: !rest.includes('NOT NULL'),
          autoIncrement: rest.includes('AUTO_INCREMENT') || rest.includes('SERIAL'),
          isPrimaryKey: rest.includes('PRIMARY KEY'),
          isUnique: rest.includes('UNIQUE'),
        };

        // Extract default value
        const defaultMatch = rest.match(/DEFAULT\s+('(?:[^'\\]|\\.)*'|\S+)/i);
        if (defaultMatch) {
          col.defaultValue = defaultMatch[1].replace(/^'|'$/g, '');
        }

        table.columns.push(col);
      }
    }

    // Apply table-level PK
    for (const pkCol of pkColumns) {
      const col = table.columns.find(c => c.name.toLowerCase() === pkCol.toLowerCase());
      if (col) col.isPrimaryKey = true;
    }

    schema.tables[id] = table;

    // Collect FK data for second-pass resolution
    for (const fk of fks) {
      const relId = generateId();
      (schema as ERDSchema & { _pendingFKs?: Array<FKDef & { sourceTableId: string; relId: string }> })._pendingFKs ??= [];
      (schema as ERDSchema & { _pendingFKs?: Array<FKDef & { sourceTableId: string; relId: string }> })._pendingFKs!.push({
        ...fk,
        sourceTableId: id,
        relId,
      });
    }
  }

  // Second pass: resolve FK references
  const pending = (schema as ERDSchema & { _pendingFKs?: Array<FKDef & { sourceTableId: string; relId: string }> })._pendingFKs;
  if (pending) {
    for (const fk of pending) {
      const referencedTable = Object.values(schema.tables).find(
        t => t.name.toLowerCase() === fk.refTable.toLowerCase()
      );
      if (!referencedTable) continue;

      const fkTable = schema.tables[fk.sourceTableId];
      if (!fkTable) continue;

      // Canonical model:
      // - source = referenced (PK/UK) side
      // - target = FK holder side
      const sourceColumnIds = fk.refColumns.map(colName =>
        referencedTable.columns.find(c => c.name.toLowerCase() === colName.toLowerCase())?.id
      ).filter((id): id is string => !!id);

      const targetColumnIds = fk.columns.map(colName =>
        fkTable.columns.find(c => c.name.toLowerCase() === colName.toLowerCase())?.id
      ).filter((id): id is string => !!id);

      schema.relationships[fk.relId] = {
        id: fk.relId,
        name: fk.constraintName,
        sourceTableId: referencedTable.id,
        targetTableId: fkTable.id,
        type: '1:N',
        sourceColumnIds,
        targetColumnIds,
        onDelete: fk.onDelete ?? 'NO ACTION',
        onUpdate: fk.onUpdate ?? 'NO ACTION',
      };
    }
    delete (schema as ERDSchema & { _pendingFKs?: unknown })._pendingFKs;
  }

  return schema;
}

// ── Parentheses-aware CREATE TABLE extractor ──────────────────────────

interface CreateTableStmt {
  schema: string | null;
  tableName: string;
  body: string;
}

function extractCreateTableStatements(sql: string): CreateTableStmt[] {
  const results: CreateTableStmt[] = [];
  // Match the CREATE TABLE header up to the opening paren
  const headerRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(\w+)`?\.)?`?(\w+)`?\s*\(/gi;

  let headerMatch;
  while ((headerMatch = headerRegex.exec(sql)) !== null) {
    const schemaName = headerMatch[1] || null;
    const tableName = headerMatch[2];
    const bodyStart = headerMatch.index + headerMatch[0].length;

    // Find the matching closing paren by counting depth
    let depth = 1;
    let i = bodyStart;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }

    if (depth !== 0) continue; // unbalanced parens, skip

    const body = sql.slice(bodyStart, i - 1); // exclude the closing paren
    results.push({ schema: schemaName, tableName, body });
  }

  return results;
}

function splitByComma(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseRefAction(action?: string): ReferentialAction {
  if (!action) return 'NO ACTION';
  const normalized = action.toUpperCase().replace(/\s+/g, ' ').trim();
  switch (normalized) {
    case 'CASCADE': return 'CASCADE';
    case 'SET NULL': return 'SET NULL';
    case 'SET DEFAULT': return 'SET DEFAULT';
    case 'RESTRICT': return 'RESTRICT';
    case 'NO ACTION': return 'NO ACTION';
    default: return 'NO ACTION';
  }
}

function normalizeDataType(dt: string): string {
  return dt.replace(/\s+/g, ' ').trim();
}
