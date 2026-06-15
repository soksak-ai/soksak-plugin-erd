import type { ERDSchema } from '@/types/schema';
import type { ReferentialAction } from '@/types/schema';
import { generateId } from '@/lib/id';

// ── 독립 ALTER ADD FOREIGN KEY 파싱(보강) ────────────────────────────────
// 기존 parseCreateTables 는 CREATE TABLE 본문의 FK 만 읽는다. ddl-generator 는
// FK 를 본문 밖 `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` 로 분리 출력하므로,
// 라운드트립을 닫으려면 그 형태를 추가로 파싱해 관계로 환원해야 한다.
// 단일 진실(parseCreateTables)을 수정하지 않고 결과 schema 에 관계를 덧붙인다.
//
// FK 방향 불변식 보존(기존 parser 와 동일):
//   source = 참조(REFERENCES 대상, PK/UK) 테이블, target = FK 보유 테이블.

const ALTER_FK_RE = new RegExp(
  // ALTER TABLE <t> ADD [CONSTRAINT <name>] FOREIGN KEY (<cols>) REFERENCES <ref> (<refcols>) [ON DELETE ..] [ON UPDATE ..]
  String.raw`ALTER\s+TABLE\s+["` +
    '`' +
    String.raw`]?(\w+)["` +
    '`' +
    String.raw`]?\s+ADD\s+(?:CONSTRAINT\s+["` +
    '`' +
    String.raw`]?(\w+)["` +
    '`' +
    String.raw`]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+["` +
    '`' +
    String.raw`]?(\w+)["` +
    '`' +
    String.raw`]?\s*\(([^)]+)\)` +
    String.raw`(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?` +
    String.raw`(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?`,
  'gi',
);

function splitCols(s: string): string[] {
  return s
    .split(',')
    .map((c) => c.trim().replace(/["`]/g, ''))
    .filter((c) => c.length > 0);
}

function refAction(a?: string): ReferentialAction {
  if (!a) return 'NO ACTION';
  const n = a.toUpperCase().replace(/\s+/g, ' ').trim();
  switch (n) {
    case 'CASCADE':
      return 'CASCADE';
    case 'SET NULL':
      return 'SET NULL';
    case 'SET DEFAULT':
      return 'SET DEFAULT';
    case 'RESTRICT':
      return 'RESTRICT';
    default:
      return 'NO ACTION';
  }
}

// ── 테이블레벨/독립 UNIQUE 제약 회복 ─────────────────────────────────────
// 기존 generateDDL 은 인라인 UNIQUE 컬럼을 테이블레벨 `UNIQUE (col)` 로 출력하는데,
// 기존 parser 는 테이블레벨 UNIQUE 를 건너뛴다(컬럼.isUnique 유실). 단일컬럼
// UNIQUE 제약을 해당 컬럼의 isUnique 로 회복해 라운드트립을 닫는다.
// (복합 UNIQUE 는 ERD 모델에 단일 표현이 없으므로 회복 대상 아님 — 무손실 보장 범위 밖.)
const UNIQUE_RE = new RegExp(
  String.raw`(?:CONSTRAINT\s+["` +
    '`' +
    String.raw`]?\w+["` +
    '`' +
    String.raw`]?\s+)?UNIQUE\s*(?:KEY\s+)?(?:["` +
    '`' +
    String.raw`]?\w+["` +
    '`' +
    String.raw`]?\s+)?\(\s*["` +
    '`' +
    String.raw`]?(\w+)["` +
    '`' +
    String.raw`]?\s*\)`,
  'gi',
);

/** CREATE TABLE 본문의 단일컬럼 UNIQUE 제약을 컬럼.isUnique 로 회복(in-place). */
export function attachUniqueConstraints(schema: ERDSchema, ddl: string): void {
  // CREATE TABLE 단위로 본문을 추출해 그 안의 UNIQUE 만 해당 테이블에 귀속.
  const headerRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(ddl)) !== null) {
    const tableName = hm[1];
    const start = hm.index + hm[0].length;
    // 짝 괄호로 본문 끝 찾기
    let depth = 1;
    let i = start;
    while (i < ddl.length && depth > 0) {
      const ch = ddl[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = ddl.slice(start, i - 1);

    const table = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === tableName.toLowerCase(),
    );
    if (!table) continue;

    UNIQUE_RE.lastIndex = 0;
    let um: RegExpExecArray | null;
    while ((um = UNIQUE_RE.exec(body)) !== null) {
      const colName = um[1];
      const col = table.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
      if (col) col.isUnique = true;
    }
  }
}

/** DDL 의 독립 ALTER ADD FOREIGN KEY 들을 schema.relationships 에 덧붙인다(in-place). */
export function attachAlterForeignKeys(schema: ERDSchema, ddl: string): void {
  ALTER_FK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALTER_FK_RE.exec(ddl)) !== null) {
    const [, fkTableName, constraintName, colStr, refTableName, refColStr, onDel, onUpd] = m;

    const fkTable = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === fkTableName.toLowerCase(),
    );
    const refTable = Object.values(schema.tables).find(
      (t) => t.name.toLowerCase() === refTableName.toLowerCase(),
    );
    if (!fkTable || !refTable) continue;

    const cols = splitCols(colStr);
    const refCols = splitCols(refColStr);

    // 중복 방지: 같은 (target, targetCols) 관계가 이미 있으면 건너뛴다.
    const already = Object.values(schema.relationships).some(
      (r) =>
        r.targetTableId === fkTable.id &&
        r.targetColumnIds
          .map((id) => fkTable.columns.find((c) => c.id === id)?.name?.toLowerCase())
          .join() === cols.map((c) => c.toLowerCase()).join(),
    );
    if (already) continue;

    const sourceColumnIds = refCols
      .map((n) => refTable.columns.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id)
      .filter((id): id is string => !!id);
    const targetColumnIds = cols
      .map((n) => fkTable.columns.find((c) => c.name.toLowerCase() === n.toLowerCase())?.id)
      .filter((id): id is string => !!id);

    const relId = generateId();
    schema.relationships[relId] = {
      id: relId,
      name: constraintName,
      sourceTableId: refTable.id, // 참조 PK 측
      targetTableId: fkTable.id, // FK 보유 측
      type: '1:N',
      sourceColumnIds,
      targetColumnIds,
      onDelete: refAction(onDel),
      onUpdate: refAction(onUpd),
    };
  }
}
