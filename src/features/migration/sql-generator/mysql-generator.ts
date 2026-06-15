import type { Operation } from '../types';
import type { SQLGenerator } from './types';

export class MySQLGenerator implements SQLGenerator {
  dialect = 'mysql' as const;

  generate(op: Operation): string {
    const p = op.params as Record<string, unknown>;

    switch (op.type) {
      case 'createTable': {
        const columns = (p.columns as Array<Record<string, unknown>>) ?? [];
        const colDefs = columns.map((c) => {
          let def = `  \`${c.name}\` ${c.dataType}`;
          if (c.length) def += `(${c.length})`;
          if (c.autoIncrement) def += ' AUTO_INCREMENT';
          if (!c.nullable) def += ' NOT NULL';
          if (c.defaultValue != null) def += ` DEFAULT ${c.defaultValue}`;
          if (c.isUnique) def += ' UNIQUE';
          if (c.comment) def += ` COMMENT '${c.comment}'`;
          return def;
        });
        const pks = columns
          .filter((c) => c.isPrimaryKey)
          .map((c) => `\`${c.name}\``);
        if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
        let sql = `CREATE TABLE \`${p.name}\` (\n${colDefs.join(',\n')}\n)`;
        if (p.engine) sql += ` ENGINE=${p.engine}`;
        if (p.charset) sql += ` DEFAULT CHARSET=${p.charset}`;
        if (p.comment) sql += ` COMMENT='${p.comment}'`;
        return sql + ';';
      }

      case 'dropTable':
        return `DROP TABLE IF EXISTS \`${p.name}\`;`;

      case 'renameTable':
        return `ALTER TABLE \`${p.oldName}\` RENAME TO \`${p.newName}\`;`;

      case 'addColumn': {
        let sql = `ALTER TABLE \`${p.table}\` ADD COLUMN \`${p.name}\` ${p.dataType ?? 'VARCHAR(255)'}`;
        if (!(p.nullable ?? true)) sql += ' NOT NULL';
        if (p.defaultValue != null) sql += ` DEFAULT ${p.defaultValue}`;
        if (p.autoIncrement) sql += ' AUTO_INCREMENT';
        if (p.isUnique) sql += ' UNIQUE';
        if (p.after) sql += ` AFTER \`${p.after}\``;
        return sql + ';';
      }

      case 'dropColumn':
        return `ALTER TABLE \`${p.table}\` DROP COLUMN \`${p.name}\`;`;

      case 'renameColumn':
        return `ALTER TABLE \`${p.table}\` RENAME COLUMN \`${p.oldName}\` TO \`${p.newName}\`;`;

      case 'modifyColumnType':
        return `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` ${p.newType};`;

      case 'modifyColumnDefault':
        return p.newDefault != null
          ? `ALTER TABLE \`${p.table}\` ALTER COLUMN \`${p.column}\` SET DEFAULT ${p.newDefault};`
          : `ALTER TABLE \`${p.table}\` ALTER COLUMN \`${p.column}\` DROP DEFAULT;`;

      case 'setColumnNullable':
        return p.nullable
          ? `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` NULL;`
          : `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` NOT NULL;`;

      case 'setColumnAutoIncrement':
        return p.autoIncrement
          ? `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\` AUTO_INCREMENT;`
          : `ALTER TABLE \`${p.table}\` MODIFY COLUMN \`${p.column}\`;`;

      case 'setColumnUnique':
        return p.unique
          ? `ALTER TABLE \`${p.table}\` ADD UNIQUE (\`${p.column}\`);`
          : `ALTER TABLE \`${p.table}\` DROP INDEX \`${p.column}\`;`;

      case 'addPrimaryKey': {
        const cols = (p.columns as string[]).map((c) => `\`${c}\``).join(', ');
        return `ALTER TABLE \`${p.table}\` ADD PRIMARY KEY (${cols});`;
      }

      case 'dropPrimaryKey':
        return `ALTER TABLE \`${p.table}\` DROP PRIMARY KEY;`;

      case 'addForeignKey': {
        const name = (p.name as string) ?? `fk_${p.table}_${(p.columns as string[])[0]}`;
        const cols = (p.columns as string[]).map((c) => `\`${c}\``).join(', ');
        const refCols = (p.refColumns as string[]).map((c) => `\`${c}\``).join(', ');
        return `ALTER TABLE \`${p.table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (${cols}) REFERENCES \`${p.refTable}\`(${refCols}) ON DELETE ${p.onDelete} ON UPDATE ${p.onUpdate};`;
      }

      case 'dropForeignKey':
        return `ALTER TABLE \`${p.table}\` DROP FOREIGN KEY \`${p.name}\`;`;

      case 'addUniqueConstraint': {
        const name = (p.name as string) ?? `uq_${p.table}_${(p.columns as string[])[0]}`;
        const cols = (p.columns as string[]).map((c) => `\`${c}\``).join(', ');
        return `ALTER TABLE \`${p.table}\` ADD CONSTRAINT \`${name}\` UNIQUE (${cols});`;
      }

      case 'dropUniqueConstraint':
        return `ALTER TABLE \`${p.table}\` DROP INDEX \`${p.name}\`;`;

      case 'createIndex': {
        const unique = p.unique ? 'UNIQUE ' : '';
        const cols = (p.columns as string[]).map((c) => `\`${c}\``).join(', ');
        return `CREATE ${unique}INDEX \`${p.name}\` ON \`${p.table}\`(${cols});`;
      }

      case 'dropIndex':
        return `DROP INDEX \`${p.name}\` ON \`${p.table}\`;`;

      default:
        return `-- Unknown operation: ${op.type}`;
    }
  }

  generateBatch(ops: Operation[]): string {
    return ops.map((op) => this.generate(op)).join('\n\n');
  }
}
