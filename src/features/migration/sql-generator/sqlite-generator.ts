import type { Operation } from '../types';
import type { SQLGenerator } from './types';

// SQLite DDL 생성기. MySQL/PG 와 달리 ALTER 표현력이 극히 제한적이다 — 컬럼 타입/기본값/nullable
// 변경, PK/제약/FK 의 ALTER 추가·삭제가 불가하다. 미지원 연산은 거짓 SQL 을 만들지 않고(R4)
// '테이블 재작성 필요' 경고 주석으로 방출한다. 실 DB 적용(Phase 6)은 이 경고를 재작성 절차로 처리한다.
export class SQLiteGenerator implements SQLGenerator {
  dialect = 'sqlite' as const;

  private q(name: unknown): string {
    return `"${name}"`;
  }

  private unsupported(op: string): string {
    return `-- SQLite: '${op}' 는 ALTER 로 불가 — 테이블 재작성 필요(수동)`;
  }

  generate(op: Operation): string {
    const p = op.params as Record<string, unknown>;

    switch (op.type) {
      case 'createTable': {
        const columns = (p.columns as Array<Record<string, unknown>>) ?? [];
        // SQLite: 단일 INTEGER PRIMARY KEY AUTOINCREMENT 는 반드시 인라인 선언, 별도 PK 절과 병존 금지.
        const inlinePk = columns.find((c) => c.autoIncrement && c.isPrimaryKey);
        const colDefs = columns.map((c) => {
          if (c === inlinePk) return `  ${this.q(c.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
          let def = `  ${this.q(c.name)} ${c.dataType}`;
          if (c.length) def += `(${c.length})`;
          if (!c.nullable) def += ' NOT NULL';
          if (c.defaultValue != null) def += ` DEFAULT ${c.defaultValue}`;
          if (c.isUnique) def += ' UNIQUE';
          return def;
        });
        if (!inlinePk) {
          const pks = columns.filter((c) => c.isPrimaryKey).map((c) => this.q(c.name));
          if (pks.length > 0) colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
        }
        return `CREATE TABLE ${this.q(p.name)} (\n${colDefs.join(',\n')}\n);`;
      }

      case 'dropTable':
        return `DROP TABLE IF EXISTS ${this.q(p.name)};`;

      case 'renameTable':
        return `ALTER TABLE ${this.q(p.oldName)} RENAME TO ${this.q(p.newName)};`;

      case 'addColumn': {
        let sql = `ALTER TABLE ${this.q(p.table)} ADD COLUMN ${this.q(p.name)} ${p.dataType ?? 'TEXT'}`;
        if (!(p.nullable ?? true)) sql += ' NOT NULL';
        if (p.defaultValue != null) sql += ` DEFAULT ${p.defaultValue}`;
        const stmt = sql + ';';
        // SQLite ADD COLUMN 은 UNIQUE 를 못 붙인다 — unique 는 별도 인덱스로.
        if (p.isUnique) {
          return `${stmt}\nCREATE UNIQUE INDEX ${this.q(`uq_${p.table}_${p.name}`)} ON ${this.q(p.table)}(${this.q(p.name)});`;
        }
        return stmt;
      }

      case 'dropColumn':
        // SQLite 3.35+
        return `ALTER TABLE ${this.q(p.table)} DROP COLUMN ${this.q(p.name)};`;

      case 'renameColumn':
        // SQLite 3.25+
        return `ALTER TABLE ${this.q(p.table)} RENAME COLUMN ${this.q(p.oldName)} TO ${this.q(p.newName)};`;

      case 'modifyColumnType':
      case 'modifyColumnDefault':
      case 'setColumnNullable':
      case 'setColumnAutoIncrement':
      case 'addPrimaryKey':
      case 'dropPrimaryKey':
      case 'addForeignKey': // FK 는 CREATE TABLE 인라인으로만, ALTER 추가 불가
      case 'dropForeignKey':
        return this.unsupported(op.type);

      case 'setColumnUnique':
        return p.unique
          ? `CREATE UNIQUE INDEX ${this.q(`uq_${p.table}_${p.column}`)} ON ${this.q(p.table)}(${this.q(p.column)});`
          : `DROP INDEX ${this.q(`uq_${p.table}_${p.column}`)};`;

      case 'addUniqueConstraint': {
        const name = (p.name as string) ?? `uq_${p.table}_${(p.columns as string[])[0]}`;
        const cols = (p.columns as string[]).map((c) => this.q(c)).join(', ');
        return `CREATE UNIQUE INDEX ${this.q(name)} ON ${this.q(p.table)}(${cols});`;
      }

      case 'dropUniqueConstraint':
        return `DROP INDEX ${this.q(p.name)};`;

      case 'createIndex': {
        const unique = p.unique ? 'UNIQUE ' : '';
        const cols = (p.columns as string[]).map((c) => this.q(c)).join(', ');
        return `CREATE ${unique}INDEX ${this.q(p.name)} ON ${this.q(p.table)}(${cols});`;
      }

      case 'dropIndex':
        // SQLite DROP INDEX 는 테이블명 절이 없다(MySQL 과 차이).
        return `DROP INDEX ${this.q(p.name)};`;

      default:
        return `-- Unknown operation: ${op.type}`;
    }
  }

  generateBatch(ops: Operation[]): string {
    return ops.map((op) => this.generate(op)).join('\n\n');
  }
}
