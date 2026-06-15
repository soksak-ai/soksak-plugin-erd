import type { ERDSchema, ReferentialAction } from '@/types/schema';
import type { Operation, MigrationVersion } from '../types';
import { generateId } from '@/lib/id';

export function applyOperation(schema: ERDSchema, op: Operation): ERDSchema {
  const next = structuredClone(schema);
  const p = op.params as Record<string, unknown>;

  switch (op.type) {
    case 'createTable': {
      const id = generateId();
      const columns = (p.columns as Array<Record<string, unknown>>) ?? [];
      next.tables[id] = {
        id,
        name: p.name as string,
        schema: p.schema as string | undefined,
        columns: columns.map((c) => ({
          id: c.id as string ?? generateId(),
          name: c.name as string,
          dataType: c.dataType as string,
          nullable: (c.nullable as boolean) ?? true,
          autoIncrement: (c.autoIncrement as boolean) ?? false,
          isPrimaryKey: (c.isPrimaryKey as boolean) ?? false,
          isUnique: (c.isUnique as boolean) ?? false,
          defaultValue: c.defaultValue as string | undefined,
          comment: c.comment as string | undefined,
          length: c.length as number | undefined,
          precision: c.precision as number | undefined,
          scale: c.scale as number | undefined,
          enumValues: c.enumValues as string[] | undefined,
        })),
        indexes: [],
        comment: p.comment as string | undefined,
        engine: p.engine as string | undefined,
        charset: p.charset as string | undefined,
      };
      break;
    }

    case 'dropTable': {
      const tableId = Object.keys(next.tables).find(
        (id) => next.tables[id].name === p.name,
      );
      if (tableId) {
        delete next.tables[tableId];
        // Remove relationships referencing this table
        for (const [relId, rel] of Object.entries(next.relationships)) {
          if (rel.sourceTableId === tableId || rel.targetTableId === tableId) {
            delete next.relationships[relId];
          }
        }
      }
      break;
    }

    case 'renameTable': {
      const entry = Object.values(next.tables).find(
        (t) => t.name === (p.oldName as string),
      );
      if (entry) entry.name = p.newName as string;
      break;
    }

    case 'addColumn': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        table.columns.push({
          id: generateId(),
          name: p.name as string,
          dataType: (p.dataType as string) ?? 'VARCHAR',
          nullable: (p.nullable as boolean) ?? true,
          autoIncrement: (p.autoIncrement as boolean) ?? false,
          isPrimaryKey: (p.isPrimaryKey as boolean) ?? false,
          isUnique: (p.isUnique as boolean) ?? false,
          defaultValue: p.defaultValue as string | undefined,
        });
      }
      break;
    }

    case 'dropColumn': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        table.columns = table.columns.filter((c) => c.name !== (p.name as string));
      }
      break;
    }

    case 'renameColumn': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.oldName as string));
        if (col) col.name = p.newName as string;
      }
      break;
    }

    case 'modifyColumnType': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.column as string));
        if (col) col.dataType = p.newType as string;
      }
      break;
    }

    case 'modifyColumnDefault': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.column as string));
        if (col) col.defaultValue = p.newDefault as string | undefined;
      }
      break;
    }

    case 'setColumnNullable': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.column as string));
        if (col) col.nullable = p.nullable as boolean;
      }
      break;
    }

    case 'setColumnAutoIncrement': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.column as string));
        if (col) col.autoIncrement = p.autoIncrement as boolean;
      }
      break;
    }

    case 'setColumnUnique': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const col = table.columns.find((c) => c.name === (p.column as string));
        if (col) col.isUnique = p.unique as boolean;
      }
      break;
    }

    case 'addPrimaryKey': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const colNames = p.columns as string[];
        for (const col of table.columns) {
          if (colNames.includes(col.name)) col.isPrimaryKey = true;
        }
      }
      break;
    }

    case 'dropPrimaryKey': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const colNames = p.columns as string[];
        for (const col of table.columns) {
          if (colNames.includes(col.name)) col.isPrimaryKey = false;
        }
      }
      break;
    }

    case 'addForeignKey': {
      const id = generateId();
      const sourceTable = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      const targetTable = Object.values(next.tables).find(
        (t) => t.name === (p.refTable as string),
      );
      if (sourceTable && targetTable) {
        const sourceColIds = (p.columns as string[])
          .map((name) => sourceTable.columns.find((c) => c.name === name)?.id)
          .filter((id): id is string => id != null);
        const targetColIds = (p.refColumns as string[])
          .map((name) => targetTable.columns.find((c) => c.name === name)?.id)
          .filter((id): id is string => id != null);

        next.relationships[id] = {
          id,
          name: p.name as string | undefined,
          sourceTableId: sourceTable.id,
          targetTableId: targetTable.id,
          type: '1:N',
          sourceColumnIds: sourceColIds,
          targetColumnIds: targetColIds,
          onDelete: p.onDelete as ReferentialAction,
          onUpdate: p.onUpdate as ReferentialAction,
        };
      }
      break;
    }

    case 'dropForeignKey': {
      const relId = Object.keys(next.relationships).find(
        (id) => next.relationships[id].name === (p.name as string),
      );
      if (relId) delete next.relationships[relId];
      break;
    }

    case 'addUniqueConstraint': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const colNames = p.columns as string[];
        if (colNames.length === 1) {
          const col = table.columns.find((c) => c.name === colNames[0]);
          if (col) col.isUnique = true;
        } else {
          const colIds = colNames
            .map((name) => table.columns.find((c) => c.name === name)?.id)
            .filter((id): id is string => id != null);
          const indexName = (p.name as string) ?? `uq_${table.name}_${colNames.join('_')}`;
          table.indexes.push({
            id: generateId(),
            name: indexName,
            columnIds: colIds,
            unique: true,
          });
        }
      }
      break;
    }

    case 'dropUniqueConstraint': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        table.indexes = table.indexes.filter((idx) => idx.name !== (p.name as string));
        // Also unset isUnique on columns if it was a single-column constraint
        const cols = p.columns as string[] | undefined;
        if (cols && cols.length === 1) {
          const col = table.columns.find((c) => c.name === cols[0]);
          if (col) col.isUnique = false;
        }
      }
      break;
    }

    case 'createIndex': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        const colIds = (p.columns as string[])
          .map((name) => table.columns.find((c) => c.name === name)?.id)
          .filter((id): id is string => id != null);
        table.indexes.push({
          id: generateId(),
          name: p.name as string,
          columnIds: colIds,
          unique: p.unique as boolean,
        });
      }
      break;
    }

    case 'dropIndex': {
      const table = Object.values(next.tables).find(
        (t) => t.name === (p.table as string),
      );
      if (table) {
        table.indexes = table.indexes.filter((idx) => idx.name !== (p.name as string));
      }
      break;
    }
  }

  return next;
}

export function restoreToVersion(
  versions: MigrationVersion[],
  targetVersionId: string,
): ERDSchema {
  let schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };
  for (const version of versions) {
    for (const op of version.operations) {
      schema = applyOperation(schema, op);
    }
    if (version.id === targetVersionId) break;
  }
  return schema;
}
