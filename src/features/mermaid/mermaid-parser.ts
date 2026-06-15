import type { ERDSchema, Table, RelationType } from '@/types/schema';
import { generateId } from '@/lib/id';

export function parseMermaid(text: string): ERDSchema {
  const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('erDiagram') && !l.startsWith('%%'));

  let currentTable: Table | null = null;

  for (const line of lines) {
    // Entity block start: "USERS {"
    const entityMatch = line.match(/^(\w+)\s*\{$/);
    if (entityMatch) {
      const id = generateId();
      currentTable = { id, name: entityMatch[1], columns: [], indexes: [] };
      schema.tables[id] = currentTable;
      continue;
    }

    // Entity block end: "}"
    if (line === '}') {
      currentTable = null;
      continue;
    }

    // Column inside entity: "int id PK" or "VARCHAR name "NOT NULL""
    if (currentTable) {
      const colMatch = line.match(/^(\w+)\s+(\w+)(.*)$/);
      if (colMatch) {
        const dataType = colMatch[1].toUpperCase();
        const name = colMatch[2];
        const flags = colMatch[3].toUpperCase();
        currentTable.columns.push({
          id: generateId(),
          name,
          dataType,
          nullable: !flags.includes('NOT NULL') && !flags.includes('PK'),
          autoIncrement: false,
          isPrimaryKey: flags.includes('PK'),
          isUnique: flags.includes('UK'),
        });
      }
      continue;
    }

    // Relationship: "USERS ||--o{ ORDERS : "has""
    const relMatch = line.match(/^(\w+)\s+(\|{1,2}|[{}]o?)(--)(\|{1,2}|o?[{}])\s+(\w+)\s*:\s*"?([^"]*)"?$/);
    if (relMatch) {
      const sourceName = relMatch[1];
      const leftMarker = relMatch[2];
      const rightMarker = relMatch[4];
      const targetName = relMatch[5];

      let type: RelationType = '1:N';
      if (rightMarker.includes('{') || leftMarker.includes('{')) {
        if (rightMarker.includes('{') && leftMarker.includes('}')) {
          type = 'N:M';
        } else {
          type = '1:N';
        }
      } else {
        type = '1:1';
      }

      const sourceTable = Object.values(schema.tables).find(t => t.name === sourceName);
      const targetTable = Object.values(schema.tables).find(t => t.name === targetName);

      if (sourceTable && targetTable) {
        const relId = generateId();
        schema.relationships[relId] = {
          id: relId,
          name: relMatch[6]?.trim() || undefined,
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id,
          type,
          sourceColumnIds: [],
          targetColumnIds: [],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        };
      }
    }
  }

  return schema;
}
