import type { Operation } from '../types';
import type { SQLGenerator } from './types';

export class PostgreSQLGenerator implements SQLGenerator {
  dialect = 'postgresql' as const;

  generate(op: Operation): string {
    const p = op.params as Record<string, unknown>;

    switch (op.type) {
      case 'createTable': {
        const columns = (p.columns as Array<Record<string, unknown>>) ?? [];
        const colDefs = columns.map((c) => {
          const isSerial = c.autoIncrement && /^(INT|INTEGER|BIGINT)/i.test(c.dataType as string);
          let def: string;
          if (isSerial) {
            const serialType = /^BIGINT/i.test(c.dataType as string) ? 'BIGSERIAL' : 'SERIAL';
            def = `  "${c.name}" ${serialType}`;
          } else {
            def = `  "${c.name}" ${c.dataType}`;
            if (c.length) def += `(${c.length})`;
          }
          if (!c.nullable) def += ' NOT NULL';
          if (c.defaultValue != null && !isSerial) def += ` DEFAULT ${c.defaultValue}`;
          if (c.isUnique) def += ' UNIQUE';
          return def;
        });
        const pks = columns
          .filter((c) => c.isPrimaryKey)
          .map((c) => `"${c.name}"`);
        if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
        const schemaPrefix = p.schema ? `"${p.schema}".` : '';
        let sql = `CREATE TABLE ${schemaPrefix}"${p.name}" (\n${colDefs.join(',\n')}\n)`;
        if (p.comment) sql += `;\nCOMMENT ON TABLE ${schemaPrefix}"${p.name}" IS '${p.comment}'`;
        return sql + ';';
      }

      case 'dropTable': {
        const schemaPrefix = p.schema ? `"${p.schema}".` : '';
        return `DROP TABLE IF EXISTS ${schemaPrefix}"${p.name}" CASCADE;`;
      }

      case 'renameTable':
        return `ALTER TABLE "${p.oldName}" RENAME TO "${p.newName}";`;

      case 'addColumn': {
        const isSerial =
          p.autoIncrement &&
          /^(INT|INTEGER|BIGINT)/i.test((p.dataType as string) ?? '');
        let colType: string;
        if (isSerial) {
          colType = /^BIGINT/i.test((p.dataType as string) ?? '') ? 'BIGSERIAL' : 'SERIAL';
        } else {
          colType = (p.dataType as string) ?? 'VARCHAR(255)';
        }
        let sql = `ALTER TABLE "${p.table}" ADD COLUMN "${p.name}" ${colType}`;
        if (!(p.nullable ?? true)) sql += ' NOT NULL';
        if (p.defaultValue != null && !isSerial) sql += ` DEFAULT ${p.defaultValue}`;
        if (p.isUnique) sql += ' UNIQUE';
        return sql + ';';
      }

      case 'dropColumn':
        return `ALTER TABLE "${p.table}" DROP COLUMN "${p.name}";`;

      case 'renameColumn':
        return `ALTER TABLE "${p.table}" RENAME COLUMN "${p.oldName}" TO "${p.newName}";`;

      case 'modifyColumnType':
        return `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" TYPE ${p.newType};`;

      case 'modifyColumnDefault':
        return p.newDefault != null
          ? `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET DEFAULT ${p.newDefault};`
          : `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP DEFAULT;`;

      case 'setColumnNullable':
        return p.nullable
          ? `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP NOT NULL;`
          : `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET NOT NULL;`;

      case 'setColumnAutoIncrement': {
        const seqName = `${p.table}_${p.column}_seq`;
        if (p.autoIncrement) {
          return [
            `CREATE SEQUENCE "${seqName}";`,
            `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" SET DEFAULT nextval('"${seqName}"');`,
            `ALTER SEQUENCE "${seqName}" OWNED BY "${p.table}"."${p.column}";`,
          ].join('\n');
        }
        return `ALTER TABLE "${p.table}" ALTER COLUMN "${p.column}" DROP DEFAULT;`;
      }

      case 'setColumnUnique':
        if (p.unique) {
          const constraintName = `uq_${p.table}_${p.column}`;
          return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${constraintName}" UNIQUE ("${p.column}");`;
        }
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "uq_${p.table}_${p.column}";`;

      case 'addPrimaryKey': {
        const cols = (p.columns as string[]).map((c) => `"${c}"`).join(', ');
        return `ALTER TABLE "${p.table}" ADD PRIMARY KEY (${cols});`;
      }

      case 'dropPrimaryKey':
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT "${p.table}_pkey";`;

      case 'addForeignKey': {
        const name = (p.name as string) ?? `fk_${p.table}_${(p.columns as string[])[0]}`;
        const cols = (p.columns as string[]).map((c) => `"${c}"`).join(', ');
        const refCols = (p.refColumns as string[]).map((c) => `"${c}"`).join(', ');
        return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${name}" FOREIGN KEY (${cols}) REFERENCES "${p.refTable}"(${refCols}) ON DELETE ${p.onDelete} ON UPDATE ${p.onUpdate};`;
      }

      case 'dropForeignKey':
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "${p.name}";`;

      case 'addUniqueConstraint': {
        const name = (p.name as string) ?? `uq_${p.table}_${(p.columns as string[])[0]}`;
        const cols = (p.columns as string[]).map((c) => `"${c}"`).join(', ');
        return `ALTER TABLE "${p.table}" ADD CONSTRAINT "${name}" UNIQUE (${cols});`;
      }

      case 'dropUniqueConstraint':
        return `ALTER TABLE "${p.table}" DROP CONSTRAINT IF EXISTS "${p.name}";`;

      case 'createIndex': {
        const unique = p.unique ? 'UNIQUE ' : '';
        const cols = (p.columns as string[]).map((c) => `"${c}"`).join(', ');
        return `CREATE ${unique}INDEX "${p.name}" ON "${p.table}"(${cols});`;
      }

      case 'dropIndex':
        return `DROP INDEX IF EXISTS "${p.name}";`;

      default:
        return `-- Unknown operation: ${op.type}`;
    }
  }

  generateBatch(ops: Operation[]): string {
    return ops.map((op) => this.generate(op)).join('\n\n');
  }
}
