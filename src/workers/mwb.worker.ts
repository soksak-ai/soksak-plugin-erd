// Web Worker for MWB file parsing
// Moves the heavy XML parsing (1.3s for 31.5MB) off the main thread

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { nanoid } from 'nanoid';
import type { ERDSchema, Column, ReferentialAction } from '@/types/schema';

export interface MWBWorkerRequest {
  type: 'parseMWB';
  payload: { buffer: ArrayBuffer };
}

export interface MWBWorkerResponse {
  type: 'parseResult' | 'error' | 'progress';
  schema?: ERDSchema;
  message?: string;
  step?: string;
  percent?: number;
}

function generateId(): string {
  return nanoid(12);
}

interface GRTValue {
  '@_type'?: string;
  '@_content-type'?: string;
  '@_key'?: string;
  '@_id'?: string;
  '@_struct-name'?: string;
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

function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val];
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function getValueByKey(node: GRTValue, key: string): string | undefined {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key) {
      const text = (v as Record<string, unknown>)['#text'];
      if (text !== undefined) return decodeEntities(String(text));
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
    if (v['@_key'] === key && (v['@_content-type'] === 'object' || v['@_type'] === 'list')) {
      return ensureArray(v.value ?? []);
    }
  }
  return undefined;
}

function getListStringValues(node: GRTValue, key: string): string[] {
  const values = ensureArray(node.value ?? []);
  for (const v of values) {
    if (v['@_key'] === key && v['@_type'] === 'list') {
      return ensureArray(v.value ?? []).map(i => decodeEntities(String(i['#text'] ?? ''))).filter(Boolean);
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
    if (v['@_key'] === key && v['@_struct-name']) return v;
  }
  return undefined;
}

function resolveDataType(simpleType: string | undefined, colNode: GRTValue): string {
  if (simpleType) {
    const parts = simpleType.split('.');
    const typeName = parts[parts.length - 1]?.toUpperCase() ?? 'VARCHAR';
    const length = getIntValueByKey(colNode, 'length');
    const noLengthTypes = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'TEXT', 'BLOB'];
    if (length && length > 0 && !noLengthTypes.includes(typeName)) {
      return `${typeName}(${length})`;
    }
    return typeName;
  }
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
    default: return 'NO ACTION';
  }
}

function hasPrimaryFlag(flags: string[]): boolean {
  const normalized = flags.map(f => f.toUpperCase().replace(/\s+/g, ' ').trim());
  return normalized.includes('PRIMARY')
    || normalized.includes('PRIMARY KEY')
    || normalized.includes('PK');
}

function findTables(doc: unknown): GRTValue[] {
  const tables: GRTValue[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj['@_struct-name'] === 'db.mysql.Table' || obj['@_struct-name'] === 'db.Table') {
      tables.push(obj as GRTValue);
      return;
    }
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

function post(msg: MWBWorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<MWBWorkerRequest>) => {
  try {
    post({ type: 'progress', step: 'Extracting ZIP...', percent: 10 });
    const zip = await JSZip.loadAsync(e.data.payload.buffer);

    const xmlFile = zip.file('document.mwb.xml');
    if (!xmlFile) throw new Error('Invalid .mwb file: document.mwb.xml not found');

    post({ type: 'progress', step: 'Reading XML...', percent: 20 });
    const xmlText = await xmlFile.async('text');

    post({ type: 'progress', step: 'Parsing XML...', percent: 30 });
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: false,
    });
    const doc = parser.parse(xmlText);

    post({ type: 'progress', step: 'Extracting tables...', percent: 60 });
    const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };
    const tableNodes = findTables(doc);
    const columnIdMap = new Map<string, { tableId: string; columnId: string }>();

    for (const tableNode of tableNodes) {
      const tableName = getValueByKey(tableNode, 'name');
      if (!tableName) continue;

      const tableId = generateId();
      const columns: Column[] = [];

      const columnsNode = getListByKey(tableNode, 'columns');
      if (columnsNode) {
        for (const colNode of ensureArray(columnsNode)) {
          const colName = getValueByKey(colNode, 'name');
          if (!colName) continue;

          const grtId = colNode['@_id'] ?? '';
          const colId = generateId();
          if (grtId) columnIdMap.set(grtId, { tableId, columnId: colId });

          const simpleType = getLinkByKey(colNode, 'simpleType');
          const dataType = resolveDataType(simpleType, colNode);
          const flags = getListStringValues(colNode, 'flags');

          columns.push({
            id: colId,
            name: colName,
            dataType,
            nullable: getIntValueByKey(colNode, 'isNotNull') !== 1,
            autoIncrement: flags.includes('AUTO_INCREMENT'),
            isPrimaryKey: hasPrimaryFlag(flags),
            isUnique: false,
            defaultValue: getValueByKey(colNode, 'defaultValue') || undefined,
            length: getIntValueByKey(colNode, 'length') || undefined,
            precision: getIntValueByKey(colNode, 'precision') || undefined,
            scale: getIntValueByKey(colNode, 'scale') || undefined,
            comment: getValueByKey(colNode, 'comment') || undefined,
          });
        }
      }

      // PK
      const pkNode = getObjectByKey(tableNode, 'primaryKey');
      if (pkNode) {
        for (const link of getListLinkValues(pkNode, 'columns')) {
          const mapped = columnIdMap.get(link);
          if (mapped) {
            const col = columns.find(c => c.id === mapped.columnId);
            if (col) col.isPrimaryKey = true;
          }
        }
      }

      // Unique indices
      const indicesNode = getListByKey(tableNode, 'indices');
      if (indicesNode) {
        for (const idxNode of ensureArray(indicesNode)) {
          const indexType = getIntValueByKey(idxNode, 'indexType');
          const idxName = (getValueByKey(idxNode, 'name') ?? '').toUpperCase();
          const isPrimary = indexType === 1 || idxName === 'PRIMARY';
          const isUnique = indexType === 2;
          if (!isPrimary && !isUnique) continue;

          const applyColumnFlag = (refColLink: string) => {
            const mapped = columnIdMap.get(refColLink);
            if (!mapped) return;
            const col = columns.find(c => c.id === mapped.columnId);
            if (!col) return;
            if (isPrimary) col.isPrimaryKey = true;
            if (isUnique) col.isUnique = true;
          };

          // Workbench variants: either columns[*].referencedColumn or direct link list.
          const idxColNodes = getListByKey(idxNode, 'columns');
          if (idxColNodes) {
            for (const idxColNode of ensureArray(idxColNodes)) {
              const refColLink = getLinkByKey(idxColNode, 'referencedColumn');
              if (refColLink) applyColumnFlag(refColLink);
            }
          }
          for (const refColLink of getListLinkValues(idxNode, 'columns')) {
            applyColumnFlag(refColLink);
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

    post({ type: 'progress', step: 'Resolving foreign keys...', percent: 80 });

    // FK
    for (const tableNode of tableNodes) {
      const fksNode = getListByKey(tableNode, 'foreignKeys');
      if (!fksNode) continue;

      for (const fkNode of ensureArray(fksNode)) {
        const fkName = getValueByKey(fkNode, 'name');
        const referencedTableLink = getLinkByKey(fkNode, 'referencedTable');
        if (!referencedTableLink) continue;

        const fkTableName = getValueByKey(tableNode, 'name');
        const fkTable = Object.values(schema.tables).find(t => t.name === fkTableName);
        if (!fkTable) continue;

        const fkColumnLinks = getListLinkValues(fkNode, 'columns');
        const refColumnLinks = getListLinkValues(fkNode, 'referencedColumns');
        const targetColumnIds = fkColumnLinks.map(link => columnIdMap.get(link)?.columnId).filter((id): id is string => !!id);
        const sourceColumnIds = refColumnLinks.map(link => columnIdMap.get(link)?.columnId).filter((id): id is string => !!id);
        const sourceEntry = refColumnLinks.length > 0 ? columnIdMap.get(refColumnLinks[0]) : undefined;
        if (!sourceEntry?.tableId) continue;

        const relId = generateId();
        schema.relationships[relId] = {
          id: relId,
          name: fkName || undefined,
          sourceTableId: sourceEntry.tableId,
          targetTableId: fkTable.id,
          type: '1:N',
          sourceColumnIds,
          targetColumnIds,
          onDelete: mapRefAction(getValueByKey(fkNode, 'deleteRule')),
          onUpdate: mapRefAction(getValueByKey(fkNode, 'updateRule')),
        };
      }
    }

    post({ type: 'progress', step: 'Done!', percent: 100 });
    post({ type: 'parseResult', schema });
  } catch (err) {
    post({ type: 'error', message: (err as Error).message });
  }
};
