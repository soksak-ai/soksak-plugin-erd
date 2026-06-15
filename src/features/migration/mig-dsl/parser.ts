// .mig DSL 재귀하강 파서 — 토큰 스트림 → Operation[](기존 migration OperationType 재사용).
// 헤드리스. 문법 오류는 line:col 을 가진 Error 로 throw 한다.
//
// EBNF(플랜 §마이그레이션):
//   migration   := comment* meta(up_block down_block?)
//   up_block    := 'up' '{' stmt* '}'
//   down_block  := 'down' '{' stmt* '}'
//   stmt        := (create_table | alter_table | drop_table | rename_table
//                  | add_fk | drop_fk | create_index | drop_index | raw) ';'
//   qname       := (ident '.')? ident
//   ALTER 는 새 전체 정의(diff 기호 금지)

import type { Operation, OperationType } from '../types';
import type { ReferentialAction } from '@/types/schema';
import { tokenize, TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { generateId } from '@/lib/id';

export interface ParseResult {
  ops: Operation[]; // up 블록의 정본 작업
  downOps: Operation[]; // down 블록(있으면). 없으면 빈 배열
  warnings: string[];
}

// line:col 을 가진 파서 오류
export interface ParseError extends Error {
  line: number;
  col: number;
}

function makeError(message: string, tok: Token): ParseError {
  const err = new Error(`${message} (line ${tok.line}, col ${tok.col})`) as ParseError;
  err.line = tok.line;
  err.col = tok.col;
  return err;
}

// 참조 동작 키워드 → ReferentialAction 정규형
const REF_ACTIONS: Record<string, ReferentialAction> = {
  cascade: 'CASCADE',
  restrict: 'RESTRICT',
  set_null: 'SET NULL',
  no_action: 'NO ACTION',
  set_default: 'SET DEFAULT',
};

class Parser {
  private toks: Token[];
  private pos = 0;
  private warnings: string[] = [];

  constructor(input: string) {
    // NL 은 파싱 시 무시(위치 추적은 각 토큰이 가짐). 주석은 meta 로만 흡수.
    this.toks = tokenize(input).filter((t) => t.type !== TokenType.NL);
  }

  // ── 토큰 커서 헬퍼 ──────────────────────────────────────────────
  private peek(): Token {
    return this.toks[this.pos];
  }

  private next(): Token {
    return this.toks[this.pos++];
  }

  private atEof(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  // 다음 토큰이 특정 키워드인지(소비하지 않음)
  private isKeyword(kw: string): boolean {
    const t = this.peek();
    return t.type === TokenType.Keyword && t.value === kw;
  }

  // 특정 키워드를 기대하고 소비. 아니면 에러.
  private expectKeyword(kw: string): Token {
    const t = this.peek();
    if (t.type !== TokenType.Keyword || t.value !== kw) {
      throw makeError(`Expected keyword '${kw}'`, t);
    }
    return this.next();
  }

  // 특정 토큰 타입을 기대하고 소비. 아니면 에러.
  private expect(type: TokenType, label: string): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw makeError(`Expected ${label}`, t);
    }
    return this.next();
  }

  // 식별자(또는 키워드도 식별자로 허용하지 않음 — 식별자만)
  private expectIdent(label = 'identifier'): Token {
    const t = this.peek();
    if (t.type !== TokenType.Ident) {
      throw makeError(`Expected ${label}`, t);
    }
    return this.next();
  }

  // qname := (ident '.')? ident → { schema?, name }
  private parseQName(): { schema?: string; name: string } {
    const first = this.expectIdent('table name');
    if (this.peek().type === TokenType.Dot) {
      this.next(); // .
      const second = this.expectIdent('table name');
      return { schema: first.value, name: second.value };
    }
    return { name: first.value };
  }

  // ── 진입점 ─────────────────────────────────────────────────────
  parse(): ParseResult {
    // comment* meta: 선행 주석은 토크나이저가 Comment 토큰으로 남기므로 흡수
    while (this.peek().type === TokenType.Comment) this.next();

    let ops: Operation[] = [];
    let downOps: Operation[] = [];

    if (this.isKeyword('up')) {
      ops = this.parseBlock('up');
    } else {
      // up 블록이 없으면 톱레벨 문장들을 up 으로 취급(편의 — 단일 블록)
      ops = this.parseStatementsUntilEof();
      return { ops, downOps, warnings: this.warnings };
    }

    // 주석 흡수
    while (this.peek().type === TokenType.Comment) this.next();

    if (this.isKeyword('down')) {
      downOps = this.parseBlock('down');
    }

    while (this.peek().type === TokenType.Comment) this.next();

    if (!this.atEof()) {
      throw makeError('Unexpected trailing tokens', this.peek());
    }

    return { ops, downOps, warnings: this.warnings };
  }

  // 'up'|'down' '{' stmt* '}'
  private parseBlock(kw: 'up' | 'down'): Operation[] {
    this.expectKeyword(kw);
    this.expect(TokenType.LBrace, "'{'");
    const ops: Operation[] = [];
    while (!this.atEof() && this.peek().type !== TokenType.RBrace) {
      if (this.peek().type === TokenType.Comment) {
        this.next();
        continue;
      }
      ops.push(this.parseStatement());
    }
    this.expect(TokenType.RBrace, "'}'");
    return ops;
  }

  // 블록 없이 톱레벨 문장(EOF 까지)
  private parseStatementsUntilEof(): Operation[] {
    const ops: Operation[] = [];
    while (!this.atEof()) {
      if (this.peek().type === TokenType.Comment) {
        this.next();
        continue;
      }
      ops.push(this.parseStatement());
    }
    return ops;
  }

  // 단일 문장 → Operation. 끝에 ';' 강제.
  private parseStatement(): Operation {
    const head = this.peek();
    if (head.type !== TokenType.Keyword) {
      throw makeError(`Expected statement keyword, got '${head.value}'`, head);
    }

    let op: Operation;
    switch (head.value) {
      case 'create':
        op = this.parseCreate();
        break;
      case 'alter':
        op = this.parseAlter();
        break;
      case 'drop':
        op = this.parseDrop();
        break;
      case 'rename':
        op = this.parseRenameTable();
        break;
      case 'add':
        op = this.parseAdd();
        break;
      case 'raw':
        op = this.parseRaw();
        break;
      default:
        throw makeError(`Unknown statement keyword '${head.value}'`, head);
    }

    this.expect(TokenType.Semicolon, "';'");
    return op;
  }

  // create table | create [unique] index
  private parseCreate(): Operation {
    this.expectKeyword('create');
    if (this.isKeyword('table')) {
      return this.parseCreateTable();
    }
    if (this.isKeyword('unique') || this.isKeyword('index')) {
      return this.parseCreateIndex();
    }
    throw makeError("Expected 'table' or 'index' after 'create'", this.peek());
  }

  // create table qname '(' column_def (';' column_def)* ')'
  private parseCreateTable(): Operation {
    this.expectKeyword('table');
    const { schema, name } = this.parseQName();
    this.expect(TokenType.LParen, "'('");

    const columns: Array<Record<string, unknown>> = [];
    // 컬럼 정의는 ';' 로 구분. 마지막 ';' 는 선택(닫는 괄호 직전 허용).
    while (this.peek().type !== TokenType.RParen && !this.atEof()) {
      columns.push(this.parseColumnDef());
      if (this.peek().type === TokenType.Semicolon) {
        this.next();
      } else if (this.peek().type !== TokenType.RParen) {
        throw makeError("Expected ';' or ')' in column list", this.peek());
      }
    }
    this.expect(TokenType.RParen, "')'");

    const params: Record<string, unknown> = { name, columns };
    if (schema) params.schema = schema;
    return this.mkOp('createTable', params);
  }

  // column_def := ident type flag*
  //   flag := 'primary' 'key' | 'auto_increment' | 'not' 'null' | 'null'
  //         | 'unique' | 'default' (string|number|ident)
  private parseColumnDef(): Record<string, unknown> {
    const nameTok = this.expectIdent('column name');
    const typeTok = this.parseTypeName();

    const col: Record<string, unknown> = { name: nameTok.value, dataType: typeTok };
    // nullable 기본값은 명시 전까지 미설정(직렬화 정규형은 not null 만 표기).

    let sawNotNull = false;
    let sawNull = false;

    while (this.peek().type === TokenType.Keyword) {
      const kw = this.peek().value;
      if (kw === 'primary') {
        this.next();
        this.expectKeyword('key');
        col.isPrimaryKey = true;
      } else if (kw === 'auto_increment') {
        this.next();
        col.autoIncrement = true;
      } else if (kw === 'not') {
        this.next();
        this.expectKeyword('null');
        sawNotNull = true;
      } else if (kw === 'null') {
        this.next();
        sawNull = true;
      } else if (kw === 'unique') {
        this.next();
        col.isUnique = true;
      } else if (kw === 'default') {
        this.next();
        col.defaultValue = this.parseDefaultValue();
      } else {
        break; // 컬럼 플래그가 아니면 종료
      }
    }

    if (sawNotNull) col.nullable = false;
    else if (sawNull) col.nullable = true;

    return col;
  }

  // 타입 이름: 식별자(+선택적 '(' 정수 [',' 정수] ')'). 타입에 붙은 길이/정밀도는 이름에 합친다.
  private parseTypeName(): string {
    const base = this.expectIdent('type name');
    let type = base.value;
    if (this.peek().type === TokenType.LParen) {
      this.next();
      const parts: string[] = [];
      while (this.peek().type !== TokenType.RParen && !this.atEof()) {
        const t = this.peek();
        if (t.type === TokenType.Number || t.type === TokenType.Ident) {
          parts.push(this.next().value);
        } else if (t.type === TokenType.Comma) {
          this.next();
        } else {
          throw makeError('Invalid type parameter', t);
        }
      }
      this.expect(TokenType.RParen, "')'");
      type += `(${parts.join(',')})`;
    }
    return type;
  }

  // default 값: 문자열은 따옴표 포함 정규형('...'), 정수/식별자(NULL·CURRENT_TIMESTAMP 등)는 원문
  private parseDefaultValue(): string {
    const t = this.peek();
    if (t.type === TokenType.String) {
      this.next();
      return `'${t.value}'`;
    }
    if (t.type === TokenType.Number) {
      this.next();
      return t.value;
    }
    if (t.type === TokenType.Ident || t.type === TokenType.Keyword) {
      this.next();
      // null 키워드 등은 대문자 정규형
      return t.value.toUpperCase() === 'NULL' ? 'NULL' : t.value;
    }
    throw makeError('Expected default value', t);
  }

  // alter table qname (add|drop|rename|alter) column ...
  private parseAlter(): Operation {
    this.expectKeyword('alter');
    this.expectKeyword('table');
    const { name: table } = this.parseQName();

    const sub = this.peek();
    if (sub.type !== TokenType.Keyword) {
      throw makeError('Expected add/drop/rename/alter in alter table', sub);
    }
    switch (sub.value) {
      case 'add': {
        this.next();
        this.expectKeyword('column');
        const colNameTok = this.expectIdent('column name');
        const typeTok = this.parseTypeName();
        const params: Record<string, unknown> = { table, name: colNameTok.value, dataType: typeTok };
        // 동일한 컬럼 플래그 파싱(not null / default 등)
        let sawNotNull = false;
        let sawNull = false;
        while (this.peek().type === TokenType.Keyword) {
          const kw = this.peek().value;
          if (kw === 'not') {
            this.next();
            this.expectKeyword('null');
            sawNotNull = true;
          } else if (kw === 'null') {
            this.next();
            sawNull = true;
          } else if (kw === 'unique') {
            this.next();
            params.isUnique = true;
          } else if (kw === 'auto_increment') {
            this.next();
            params.autoIncrement = true;
          } else if (kw === 'default') {
            this.next();
            params.defaultValue = this.parseDefaultValue();
          } else break;
        }
        if (sawNotNull) params.nullable = false;
        else if (sawNull) params.nullable = true;
        return this.mkOp('addColumn', params);
      }
      case 'drop': {
        this.next();
        this.expectKeyword('column');
        const colNameTok = this.expectIdent('column name');
        return this.mkOp('dropColumn', { table, name: colNameTok.value });
      }
      case 'rename': {
        this.next();
        this.expectKeyword('column');
        const oldTok = this.expectIdent('column name');
        this.expectKeyword('to');
        const newTok = this.expectIdent('column name');
        return this.mkOp('renameColumn', { table, oldName: oldTok.value, newName: newTok.value });
      }
      case 'alter': {
        // alter column <col> <newType> → 새 전체 타입 정의(diff 기호 금지)
        this.next();
        this.expectKeyword('column');
        const colTok = this.expectIdent('column name');
        const newType = this.parseTypeName();
        return this.mkOp('modifyColumnType', { table, column: colTok.value, newType });
      }
      default:
        throw makeError(`Unknown alter action '${sub.value}'`, sub);
    }
  }

  // drop table qname | drop fk name on qname | drop index name on qname
  private parseDrop(): Operation {
    this.expectKeyword('drop');
    if (this.isKeyword('table')) {
      this.next();
      const { name } = this.parseQName();
      return this.mkOp('dropTable', { name });
    }
    if (this.isKeyword('fk')) {
      this.next();
      const fkName = this.expectIdent('fk name').value;
      this.expectKeyword('on');
      const { name: table } = this.parseQName();
      return this.mkOp('dropForeignKey', { table, name: fkName });
    }
    if (this.isKeyword('index')) {
      this.next();
      const idxName = this.expectIdent('index name').value;
      this.expectKeyword('on');
      const { name: table } = this.parseQName();
      return this.mkOp('dropIndex', { table, name: idxName });
    }
    throw makeError("Expected 'table', 'fk', or 'index' after 'drop'", this.peek());
  }

  // rename table qname to ident
  private parseRenameTable(): Operation {
    this.expectKeyword('rename');
    this.expectKeyword('table');
    const { name: oldName } = this.parseQName();
    this.expectKeyword('to');
    const newName = this.expectIdent('new table name').value;
    return this.mkOp('renameTable', { oldName, newName });
  }

  // add fk name on qname '(' cols ')' -> qname '(' cols ')' [on delete X] [on update Y]
  private parseAdd(): Operation {
    this.expectKeyword('add');
    this.expectKeyword('fk');
    const fkName = this.expectIdent('fk name').value;
    this.expectKeyword('on');
    const { name: table } = this.parseQName();
    const columns = this.parseColumnList();
    this.expect(TokenType.Arrow, "'->'");
    const { name: refTable } = this.parseQName();
    const refColumns = this.parseColumnList();

    let onDelete: ReferentialAction = 'NO ACTION';
    let onUpdate: ReferentialAction = 'NO ACTION';

    // on delete X / on update Y (순서 무관, 각 0..1)
    while (this.isKeyword('on')) {
      this.next();
      if (this.isKeyword('delete')) {
        this.next();
        onDelete = this.parseRefAction();
      } else if (this.isKeyword('update')) {
        this.next();
        onUpdate = this.parseRefAction();
      } else {
        throw makeError("Expected 'delete' or 'update' after 'on'", this.peek());
      }
    }

    return this.mkOp('addForeignKey', {
      name: fkName,
      table,
      columns,
      refTable,
      refColumns,
      onDelete,
      onUpdate,
    });
  }

  // 참조 동작: cascade/restrict/set null/no action/set default
  private parseRefAction(): ReferentialAction {
    const t = this.peek();
    // 'set' 은 키워드가 아니므로 식별자/연쇄로 처리. 우리 키워드 집합엔 없음 → 단순 단어 합성.
    const first = this.consumeWord();
    let key = first.toLowerCase();
    // 'set null' / 'no action' / 'set default' 두 단어 합성
    if (key === 'set' || key === 'no') {
      const second = this.consumeWord();
      key = `${key}_${second.toLowerCase()}`;
    }
    const action = REF_ACTIONS[key];
    if (!action) {
      throw makeError(`Unknown referential action '${key.replace('_', ' ')}'`, t);
    }
    return action;
  }

  // 키워드/식별자 어느 쪽이든 단어 하나를 소비해 값 반환
  private consumeWord(): string {
    const t = this.peek();
    if (t.type === TokenType.Keyword || t.type === TokenType.Ident) {
      return this.next().value;
    }
    throw makeError('Expected word', t);
  }

  // create [unique] index name on qname '(' cols ')'
  private parseCreateIndex(): Operation {
    let unique = false;
    if (this.isKeyword('unique')) {
      this.next();
      unique = true;
    }
    this.expectKeyword('index');
    const idxName = this.expectIdent('index name').value;
    this.expectKeyword('on');
    const { name: table } = this.parseQName();
    const columns = this.parseColumnList();
    return this.mkOp('createIndex', { table, name: idxName, columns, unique });
  }

  // raw '<sql string>'
  private parseRaw(): Operation {
    this.expectKeyword('raw');
    const sqlTok = this.expect(TokenType.String, 'raw SQL string');
    return this.mkOp('raw' as OperationType, { sql: sqlTok.value });
  }

  // '(' ident (',' ident)* ')'
  private parseColumnList(): string[] {
    this.expect(TokenType.LParen, "'('");
    const cols: string[] = [];
    cols.push(this.expectIdent('column name').value);
    while (this.peek().type === TokenType.Comma) {
      this.next();
      cols.push(this.expectIdent('column name').value);
    }
    this.expect(TokenType.RParen, "')'");
    return cols;
  }

  // Operation 생성(id/timestamp 채움)
  private mkOp(type: OperationType, params: Record<string, unknown>): Operation {
    return { id: generateId(), type, timestamp: 0, params };
  }
}

// 공개 함수: 텍스트 → ParseResult
export function parse(input: string): ParseResult {
  return new Parser(input).parse();
}
