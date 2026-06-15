// .mig DSL 직렬화기 — Operation[] → 결정적·정규형 텍스트.
// 고정 들여쓰기(2칸), 고정 문장 순서, 컬럼 플래그 고정 순서.
// down 미기재 시 inverse.ts 로 역연산을 자동 파생한다.
// 헤드리스(DOM/React/Pixi 무관).

import type { Operation } from '../types';
import { generateInverse } from '../operations/inverse';

const INDENT = '  '; // 블록 내부 1단계 들여쓰기

// 단일 컬럼 정의 → 정규형 문자열(플래그 고정 순서).
// 순서: <name> <type> [primary key] [auto_increment] [not null|null] [unique] [default V]
// nullable 은 명시값을 무손실 보존한다: false→'not null', true→'null', 미설정→생략.
function serializeColumnDef(c: Record<string, unknown>): string {
  const parts: string[] = [String(c.name), String(c.dataType)];
  if (c.isPrimaryKey) parts.push('primary key');
  if (c.autoIncrement) parts.push('auto_increment');
  if (c.nullable === false) parts.push('not null');
  else if (c.nullable === true) parts.push('null');
  if (c.isUnique) parts.push('unique');
  if (c.defaultValue != null) parts.push(`default ${String(c.defaultValue)}`);
  return parts.join(' ');
}

// qname 정규형: schema 있으면 schema.name
function qname(name: unknown, schema?: unknown): string {
  return schema ? `${String(schema)}.${String(name)}` : String(name);
}

// 참조 동작 정규형(소문자 키워드)
function refAction(a: unknown): string {
  return String(a).toLowerCase();
}

// 단일 Operation → 정규형 문장(세미콜론 포함). 들여쓰기는 호출측에서.
function serializeOp(op: Operation): string {
  const p = op.params as Record<string, unknown>;

  switch (op.type) {
    case 'createTable': {
      const cols = (p.columns as Array<Record<string, unknown>>) ?? [];
      const header = `create table ${qname(p.name, p.schema)} (`;
      const colLines = cols.map((c) => `${INDENT}${INDENT}${serializeColumnDef(c)};`);
      return `${header}\n${colLines.join('\n')}\n${INDENT});`;
    }

    case 'addColumn': {
      const flags: string[] = [];
      if (p.nullable === false) flags.push('not null');
      if (p.isUnique) flags.push('unique');
      if (p.autoIncrement) flags.push('auto_increment');
      if (p.defaultValue != null) flags.push(`default ${String(p.defaultValue)}`);
      const tail = flags.length ? ` ${flags.join(' ')}` : '';
      return `alter table ${String(p.table)} add column ${String(p.name)} ${String(p.dataType)}${tail};`;
    }

    case 'dropColumn':
      return `alter table ${String(p.table)} drop column ${String(p.name)};`;

    case 'renameColumn':
      return `alter table ${String(p.table)} rename column ${String(p.oldName)} to ${String(p.newName)};`;

    case 'modifyColumnType':
      return `alter table ${String(p.table)} alter column ${String(p.column)} ${String(p.newType)};`;

    case 'dropTable':
      return `drop table ${qname(p.name, p.schema)};`;

    case 'renameTable':
      return `rename table ${String(p.oldName)} to ${String(p.newName)};`;

    case 'addForeignKey': {
      const cols = (p.columns as string[]).join(', ');
      const refCols = (p.refColumns as string[]).join(', ');
      let s = `add fk ${String(p.name)} on ${String(p.table)} ( ${cols} ) -> ${String(p.refTable)} ( ${refCols} )`;
      s += ` on delete ${refAction(p.onDelete)} on update ${refAction(p.onUpdate)}`;
      return `${s};`;
    }

    case 'dropForeignKey':
      return `drop fk ${String(p.name)} on ${String(p.table)};`;

    case 'createIndex': {
      const cols = (p.columns as string[]).join(', ');
      const uniq = p.unique ? 'unique ' : '';
      return `create ${uniq}index ${String(p.name)} on ${String(p.table)} ( ${cols} );`;
    }

    case 'dropIndex':
      return `drop index ${String(p.name)} on ${String(p.table)};`;

    // raw 는 OperationType 에 없으므로 문자열 비교로 처리
    default:
      if ((op.type as string) === 'raw') {
        return `raw '${String(p.sql)}';`;
      }
      throw new Error(`serialize: unsupported operation type '${op.type}'`);
  }
}

// 블록 본문(문장들) → 들여쓰기 적용 텍스트
function serializeBlockBody(ops: Operation[]): string {
  return ops
    .map((op) => {
      const text = serializeOp(op);
      // 멀티라인(createTable)도 첫 줄만 INDENT, 나머지 줄은 자체 들여쓰기를 이미 포함
      return text
        .split('\n')
        .map((line, i) => (i === 0 ? `${INDENT}${line}` : line))
        .join('\n');
    })
    .join('\n');
}

export interface SerializeOptions {
  // 명시 down ops. 없으면 inverse.ts 로 자동 파생.
  downOps?: Operation[];
  // down 블록을 아예 생략(자동파생도 안 함)
  omitDown?: boolean;
}

// 공개 함수: Operation[] → 정규형 .mig 텍스트
export function serialize(ops: Operation[], opts: SerializeOptions = {}): string {
  const upBody = serializeBlockBody(ops);
  let out = `up {\n${upBody}\n}`;

  if (opts.omitDown) return out;

  // down: 명시 우선, 없으면 inverse 자동 파생(역순)
  let downOps = opts.downOps;
  if (!downOps || downOps.length === 0) {
    downOps = [];
    for (let i = ops.length - 1; i >= 0; i--) {
      const inv = generateInverse(ops[i]);
      if (inv) downOps.push(inv);
    }
  }

  if (downOps.length > 0) {
    const downBody = serializeBlockBody(downOps);
    out += `\ndown {\n${downBody}\n}`;
  }

  return out;
}
