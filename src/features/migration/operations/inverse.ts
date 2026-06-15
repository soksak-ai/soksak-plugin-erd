import type { Operation } from '../types';

export function generateInverse(op: Operation): Operation | null {
  const p = op.params as Record<string, unknown>;

  switch (op.type) {
    case 'createTable':
      return {
        ...op,
        type: 'dropTable',
        params: { name: p.name, _tableData: op.params },
      };

    case 'dropTable':
      return p._tableData
        ? { ...op, type: 'createTable', params: p._tableData as Record<string, unknown> }
        : null;

    case 'renameTable':
      return {
        ...op,
        type: 'renameTable',
        params: { oldName: p.newName, newName: p.oldName },
      };

    case 'addColumn':
      return {
        ...op,
        type: 'dropColumn',
        params: { table: p.table, name: p.name, _columnData: op.params },
      };

    case 'dropColumn':
      return p._columnData
        ? { ...op, type: 'addColumn', params: p._columnData as Record<string, unknown> }
        : null;

    case 'renameColumn':
      return {
        ...op,
        type: 'renameColumn',
        params: { table: p.table, oldName: p.newName, newName: p.oldName },
      };

    case 'modifyColumnType':
      return {
        ...op,
        type: 'modifyColumnType',
        params: { table: p.table, column: p.column, oldType: p.newType, newType: p.oldType },
      };

    case 'modifyColumnDefault':
      return {
        ...op,
        type: 'modifyColumnDefault',
        params: { table: p.table, column: p.column, oldDefault: p.newDefault, newDefault: p.oldDefault },
      };

    case 'setColumnNullable':
      return {
        ...op,
        type: 'setColumnNullable',
        params: { table: p.table, column: p.column, nullable: p.oldNullable, oldNullable: p.nullable },
      };

    case 'setColumnAutoIncrement':
      return {
        ...op,
        type: 'setColumnAutoIncrement',
        params: { table: p.table, column: p.column, autoIncrement: !(p.autoIncrement as boolean) },
      };

    case 'setColumnUnique':
      return {
        ...op,
        type: 'setColumnUnique',
        params: { table: p.table, column: p.column, unique: !(p.unique as boolean) },
      };

    case 'addPrimaryKey':
      return {
        ...op,
        type: 'dropPrimaryKey',
        params: { table: p.table, columns: p.columns },
      };

    case 'dropPrimaryKey':
      return {
        ...op,
        type: 'addPrimaryKey',
        params: { table: p.table, columns: p.columns },
      };

    case 'addForeignKey': {
      const fkName = (p.name as string) ?? `fk_${p.table as string}_${(p.columns as string[])[0]}`;
      return {
        ...op,
        type: 'dropForeignKey',
        params: { table: p.table, name: fkName, _fkData: op.params },
      };
    }

    case 'dropForeignKey':
      return p._fkData
        ? { ...op, type: 'addForeignKey', params: p._fkData as Record<string, unknown> }
        : null;

    case 'addUniqueConstraint': {
      const uqName = (p.name as string) ?? `uq_${p.table as string}_${(p.columns as string[])[0]}`;
      return {
        ...op,
        type: 'dropUniqueConstraint',
        params: { table: p.table, name: uqName, columns: p.columns },
      };
    }

    case 'dropUniqueConstraint':
      return p.columns
        ? { ...op, type: 'addUniqueConstraint', params: { table: p.table, name: p.name, columns: p.columns } }
        : null;

    case 'createIndex':
      return {
        ...op,
        type: 'dropIndex',
        params: { table: p.table, name: p.name, _indexData: op.params },
      };

    case 'dropIndex':
      return p._indexData
        ? { ...op, type: 'createIndex', params: p._indexData as Record<string, unknown> }
        : null;

    default:
      return null;
  }
}
