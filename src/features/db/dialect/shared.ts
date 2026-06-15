import type { DialectCaps, SchemaDiff } from './types';

// ── 식별자 인용(공통) ─────────────────────────────────────────────────────
// 인용 부호 자체가 이름에 있으면 두 배로 이스케이프(표준 SQL 규칙).
export function quote(name: string, q: string): string {
  return q + name.split(q).join(q + q) + q;
}

export function isReservedIn(word: string, reserved: Set<string>): boolean {
  return reserved.has(word.toUpperCase());
}

// ── 인용 부호 정규화(parser 위임용) ───────────────────────────────────────
// 기존 parseCreateTables 는 식별자 인용으로 backtick(또는 무인용)만 인식한다.
// PG/SQLite 는 double-quote 를 쓰므로, 위임 전에 식별자 인용 부호를 backtick 으로
// 치환한다. 문자열 리터럴은 single-quote 라 영향 없음(double-quote 는 식별자 전용).
export function normalizeQuotesForParser(ddl: string): string {
  return ddl.split('"').join('`');
}

// ── generateAlter 공통 구현 ───────────────────────────────────────────────
// caps 로 dialect 차이를 흡수. SQLite(alterAddConstraint=false)는 FK 추가를
// ALTER 로 표현할 수 없으므로 경고 주석으로 대체(테이블 재작성 필요).
export function generateAlterFor(
  diff: SchemaDiff,
  caps: DialectCaps,
  q: (name: string) => string,
): string {
  const out: string[] = [];

  for (const t of diff.droppedTables) {
    out.push(`DROP TABLE IF EXISTS ${q(t)};`);
  }

  for (const t of diff.addedTables) {
    // 테이블 본문은 generate(schema) 가 담당 — diff 레벨에선 자리표시만.
    out.push(`-- ADD TABLE ${q(t)} (use generate() for full CREATE)`);
  }

  for (const { table, column } of diff.addedColumns) {
    const nn = column.nullable ? '' : ' NOT NULL';
    const def =
      column.defaultValue !== undefined && column.defaultValue !== ''
        ? ` DEFAULT ${column.defaultValue}`
        : '';
    out.push(`ALTER TABLE ${q(table)} ADD COLUMN ${q(column.name)} ${column.dataType}${nn}${def};`);
  }

  for (const { table, column } of diff.droppedColumns) {
    out.push(`ALTER TABLE ${q(table)} DROP COLUMN ${q(column)};`);
  }

  for (const fk of diff.addedRelationships) {
    const name = fk.name ?? `fk_${fk.table}_${fk.columns[0] ?? 'x'}`;
    const cols = fk.columns.map(q).join(', ');
    const refCols = fk.refColumns.map(q).join(', ');
    if (caps.alterAddConstraint) {
      out.push(
        `ALTER TABLE ${q(fk.table)} ADD CONSTRAINT ${q(name)} ` +
          `FOREIGN KEY (${cols}) REFERENCES ${q(fk.refTable)} (${refCols}) ` +
          `ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`,
      );
    } else {
      // SQLite: ALTER 로 FK 추가 불가 → 테이블 재작성 안내(꼼수 금지: 거짓 SQL 미발행).
      out.push(
        `-- SQLite: cannot ADD FOREIGN KEY via ALTER (${name}); ` +
          `recreate table ${fk.table} with inline FK to ${fk.refTable}.`,
      );
    }
  }

  for (const fk of diff.droppedRelationships) {
    if (caps.alterAddConstraint) {
      out.push(`ALTER TABLE ${q(fk.table)} DROP CONSTRAINT ${q(fk.name)};`);
    } else {
      out.push(
        `-- SQLite: cannot DROP CONSTRAINT ${fk.name} via ALTER; recreate table ${fk.table}.`,
      );
    }
  }

  return out.join('\n');
}
