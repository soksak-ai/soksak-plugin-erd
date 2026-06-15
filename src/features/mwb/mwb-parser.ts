import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { ERDSchema, Column, ReferentialAction } from '@/types/schema';
import { generateId } from '@/lib/id';

interface GRTValue {
  '@_type'?: string;
  '@_content-type'?: string;
  '@_key'?: string;
  '@_id'?: string;
  '@_struct-name'?: string;
  '@_struct-checksum'?: string;
  value?: GRTValue | GRTValue[];
  link?: GRTLink | GRTLink[];
  '#text'?: string;
}

interface GRTLink {
  '@_type'?: string;
  '@_key'?: string;
  '@_struct-name'?: string;
  '#text'?: string;
}

export async function parseMWBFile(file: File): Promise<ERDSchema> {
  const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };
  const zip = await JSZip.loadAsync(file);

  // .mwb files contain a document.mwb.xml at the root
  const xmlFile = zip.file('document.mwb.xml');
  if (!xmlFile) {
    throw new Error('Invalid .mwb file: document.mwb.xml not found');
  }
  const xmlText = await xmlFile.async('text');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xmlText);

  // Navigate to tables in the GRT structure
  // Typical path: data > value(GrtObject) > ... > catalog > schemata > tables
  try {
    const tables = findTables(doc);
    const columnIdMap = new Map<string, { tableId: string; columnId: string }>();

    for (const tableNode of tables) {
      const tableName = getValueByKey(tableNode, 'name');
      if (!tableName) continue;

      const tableId = generateId();
      const columns: Column[] = [];

      const columnsNode = getListByKey(tableNode, 'columns');
      if (columnsNode) {
        const colNodes = ensureArray(columnsNode);
        for (const colNode of colNodes) {
          const colName = getValueByKey(colNode, 'name');
          if (!colName) continue;

          const grtId = colNode['@_id'] ?? '';
          const colId = generateId();

          // Map GRT ID to our ID for FK resolution
          if (grtId) {
            columnIdMap.set(grtId, { tableId, columnId: colId });
          }

          const simpleType = getLinkByKey(colNode, 'simpleType');
          const userType = getLinkByKey(colNode, 'userType');
          const dataType = resolveDataType(simpleType, userType, colNode);

          const flags = getListStringValues(colNode, 'flags');
          const autoIncrement = flags.includes('AUTO_INCREMENT');

          columns.push({
            id: colId,
            name: colName,
            dataType,
            nullable: getIntValueByKey(colNode, 'isNotNull') !== 1,
            autoIncrement,
            isPrimaryKey: false,
            isUnique: false,
            defaultValue: getValueByKey(colNode, 'defaultValue') || undefined,
            length: getIntValueByKey(colNode, 'length') || undefined,
            precision: getIntValueByKey(colNode, 'precision') || undefined,
            scale: getIntValueByKey(colNode, 'scale') || undefined,
            comment: getValueByKey(colNode, 'comment') || undefined,
          });
        }
      }

      // Check for primary key columns
      const pkNode = getObjectByKey(tableNode, 'primaryKey');
      if (pkNode) {
        const pkColLinks = getListLinkValues(pkNode, 'columns');
        for (const link of pkColLinks) {
          const mapped = columnIdMap.get(link);
          if (mapped) {
            const col = columns.find(c => c.id === mapped.columnId);
            if (col) col.isPrimaryKey = true;
          }
        }
      }

      // Check indices for unique constraints
      const indicesNode = getListByKey(tableNode, 'indices');
      if (indicesNode) {
        const indexNodes = ensureArray(indicesNode);
        for (const idxNode of indexNodes) {
          const indexType = getIntValueByKey(idxNode, 'indexType');
          const isPrimary = indexType === 1;
          const isUnique = indexType === 2;
          if (isPrimary || isUnique) {
            const idxColNodes = getListByKey(idxNode, 'columns');
            if (idxColNodes) {
              for (const idxColNode of ensureArray(idxColNodes)) {
                const refColLink = getLinkByKey(idxColNode, 'referencedColumn');
                if (refColLink) {
                  const mapped = columnIdMap.get(refColLink);
                  if (mapped) {
                    const col = columns.find(c => c.id === mapped.columnId);
                    if (col) {
                      if (isPrimary) col.isPrimaryKey = true;
                      if (isUnique) col.isUnique = true;
                    }
                  }
                }
              }
            }
          }
        }
      }

      schema.tables[tableId] = {
        id: tableId,
        name: tableName,
        columns,
        indexes: [],
        comment: getValueByKey(tableNode, 'comment') || undefined,
      };
    }

    // Process foreign keys
    for (const tableNode of tables) {
      const fksNode = getListByKey(tableNode, 'foreignKeys');
      if (!fksNode) continue;

      for (const fkNode of ensureArray(fksNode)) {
        const fkName = getValueByKey(fkNode, 'name');
        const referencedTableLink = getLinkByKey(fkNode, 'referencedTable');
        if (!referencedTableLink) continue;

        // Find source table
        const sourceTableName = getValueByKey(tableNode, 'name');
        const sourceTable = Object.values(schema.tables).find(t => t.name === sourceTableName);
        if (!sourceTable) continue;

        // Resolve FK column mappings
        const fkColumnLinks = getListLinkValues(fkNode, 'columns');
        const refColumnLinks = getListLinkValues(fkNode, 'referencedColumns');

        const sourceColumnIds = fkColumnLinks
          .map(link => columnIdMap.get(link)?.columnId)
          .filter((id): id is string => !!id);

        const targetColumnIds = refColumnLinks
          .map(link => columnIdMap.get(link)?.columnId)
          .filter((id): id is string => !!id);

        // Find target table by column ID
        const targetEntry = refColumnLinks.length > 0 ? columnIdMap.get(refColumnLinks[0]) : undefined;
        const targetTableId = targetEntry?.tableId;
        if (!targetTableId) continue;

        const deleteRule = getValueByKey(fkNode, 'deleteRule');
        const updateRule = getValueByKey(fkNode, 'updateRule');

        const relId = generateId();
        schema.relationships[relId] = {
          id: relId,
          name: fkName || undefined,
          sourceTableId: sourceTable.id,
          targetTableId,
          type: '1:N',
          sourceColumnIds,
          targetColumnIds,
          onDelete: mapRefAction(deleteRule),
          onUpdate: mapRefAction(updateRule),
        };
      }
    }
  } catch (_e) {
    // If parsing fails, return whatever we've collected so far
    if (Object.keys(schema.tables).length === 0) {
      throw new Error('Could not parse .mwb file structure. The file format may not be supported.');
    }
  }

  return schema;
}

function findTables(doc: unknown): GRTValue[] {
  const tables: GRTValue[] = [];

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;

    // Check if this is a table struct
    if (obj['@_struct-name'] === 'db.mysql.Table' || obj['@_struct-name'] === 'db.Table') {
      tables.push(obj as GRTValue);
      return;
    }

    // Recurse into children
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        for (const item of val) walk(item);
      } else if (typeof val === 'object' && val !== null) {
        walk(val);
      }
    }
  }

  walk(doc);
  return tables;
}

function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

function getValueByKey(node: GRTValue, key: string): string | undefined {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key && v['#text'] !== undefined) {
      return String(v['#text']);
    }
    if (v['@_key'] === key && typeof v === 'object') {
      const text = (v as Record<string, unknown>)['#text'];
      if (text !== undefined) return String(text);
    }
  }
  return undefined;
}

function getIntValueByKey(node: GRTValue, key: string): number | undefined {
  const val = getValueByKey(node, key);
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

function getLinkByKey(node: GRTValue, key: string): string | undefined {
  const links = ensureArray(node.link ?? []);
  for (const l of links) {
    if (l['@_key'] === key && l['#text'] !== undefined) {
      return String(l['#text']);
    }
  }
  return undefined;
}

function getListByKey(node: GRTValue, key: string): GRTValue[] | undefined {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key && v['@_content-type'] === 'object') {
      const items = ensureArray(v.value ?? []);
      return items;
    }
    if (v['@_key'] === key && v['@_type'] === 'list') {
      const items = ensureArray(v.value ?? []);
      return items;
    }
  }
  return undefined;
}

function getListStringValues(node: GRTValue, key: string): string[] {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key && v['@_type'] === 'list') {
      const items = ensureArray(v.value ?? []);
      return items.map(i => String(i['#text'] ?? '')).filter(Boolean);
    }
  }
  return [];
}

function getListLinkValues(node: GRTValue, key: string): string[] {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key) {
      const links = ensureArray(v.link ?? []);
      return links.map(l => String(l['#text'] ?? '')).filter(Boolean);
    }
  }
  return [];
}

function getObjectByKey(node: GRTValue, key: string): GRTValue | undefined {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key && v['@_struct-name']) {
      return v;
    }
  }
  // Also check links
  const link = getLinkByKey(node, key);
  if (link) {
    // Return a stub with the link as reference
    return { '@_id': link } as GRTValue;
  }
  return undefined;
}

function resolveDataType(simpleType: string | undefined, _userType: string | undefined, colNode: GRTValue): string {
  if (simpleType) {
    // GRT stores type names like "com.mysql.rdbms.mysql.datatype.int"
    const parts = simpleType.split('.');
    const typeName = parts[parts.length - 1]?.toUpperCase() ?? 'VARCHAR';
    const length = getIntValueByKey(colNode, 'length');
    if (length && length > 0 && !['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'TEXT', 'BLOB'].includes(typeName)) {
      return `${typeName}(${length})`;
    }
    return typeName;
  }
  // Fallback: try to extract from formattedType value
  const formatted = getValueByKey(colNode, 'formattedType');
  if (formatted) return formatted.toUpperCase();
  return 'VARCHAR';
}

function mapRefAction(action: string | undefined): ReferentialAction {
  if (!action) return 'NO ACTION';
  switch (action.toUpperCase()) {
    case 'CASCADE': return 'CASCADE';
    case 'SET NULL': return 'SET NULL';
    case 'SET DEFAULT': return 'SET DEFAULT';
    case 'RESTRICT': return 'RESTRICT';
    case 'NO ACTION': return 'NO ACTION';
    default: return 'NO ACTION';
  }
}
