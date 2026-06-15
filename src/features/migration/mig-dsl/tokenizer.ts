// .mig DSL 토크나이저 — DB-비종속 정본 텍스트를 토큰 스트림으로 변환.
// 헤드리스(DOM/React/Pixi 무관). line:col 추적으로 파서 에러를 정확히 보고.

// erasableSyntaxOnly 환경이므로 enum 대신 const 객체 + 유니온 타입 사용.
export const TokenType = {
  Keyword: 'Keyword',
  Ident: 'Ident',
  Number: 'Number',
  String: 'String',
  Comment: 'Comment',
  LBrace: 'LBrace', // {
  RBrace: 'RBrace', // }
  LParen: 'LParen', // (
  RParen: 'RParen', // )
  Semicolon: 'Semicolon', // ;
  Dot: 'Dot', // .
  Comma: 'Comma', // ,
  Arrow: 'Arrow', // ->
  NL: 'NL', // 줄바꿈(파서는 무시하지만 위치 보존용으로 노출)
  EOF: 'EOF',
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  line: number; // 1-based
  col: number; // 1-based
}

// 예약 키워드 집합(소문자 비교). 식별자와 구분하기 위해 사용.
export const KEYWORDS = new Set<string>([
  'create',
  'table',
  'alter',
  'add',
  'drop',
  'rename',
  'column',
  'fk',
  'index',
  'unique',
  'on',
  'delete',
  'update',
  'up',
  'down',
  'raw',
  'to',
  'primary',
  'key',
  'not',
  'null',
  'auto_increment',
  'default',
  'check',
]);

// 식별자 시작 문자: 영문/언더스코어
function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

// 식별자 본문 문자: 영문/숫자/언더스코어
function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

// 토크나이즈: 입력 문자열 → Token[]. 마지막은 항상 EOF.
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const n = input.length;

  // 1글자 전진(개행 추적)
  function advance(): string {
    const ch = input[i++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  while (i < n) {
    const ch = input[i];
    const startLine = line;
    const startCol = col;

    // 줄바꿈
    if (ch === '\n') {
      advance();
      tokens.push({ type: TokenType.NL, value: '\n', line: startLine, col: startCol });
      continue;
    }

    // 공백(개행 외)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    // 주석 `-- ...` (줄 끝까지). 단, `->` 화살표와 충돌하지 않도록 먼저 검사.
    if (ch === '-' && input[i + 1] === '-') {
      advance(); // -
      advance(); // -
      let value = '';
      while (i < n && input[i] !== '\n') value += advance();
      tokens.push({ type: TokenType.Comment, value: value.trim(), line: startLine, col: startCol });
      continue;
    }

    // 화살표 `->`
    if (ch === '-' && input[i + 1] === '>') {
      advance(); // -
      advance(); // >
      tokens.push({ type: TokenType.Arrow, value: '->', line: startLine, col: startCol });
      continue;
    }

    // 문자열 리터럴: 작은따옴표. 내부 '' 은 escape 로 단일 ' 처리.
    if (ch === "'") {
      advance(); // 여는 따옴표
      let value = '';
      let closed = false;
      while (i < n) {
        const c = input[i];
        if (c === "'") {
          // '' escape?
          if (input[i + 1] === "'") {
            advance();
            advance();
            value += "'";
            continue;
          }
          advance(); // 닫는 따옴표
          closed = true;
          break;
        }
        value += advance();
      }
      if (!closed) {
        throw makeLexError('Unterminated string literal', startLine, startCol);
      }
      tokens.push({ type: TokenType.String, value, line: startLine, col: startCol });
      continue;
    }

    // 정수 리터럴
    if (isDigit(ch)) {
      let value = '';
      while (i < n && isDigit(input[i])) value += advance();
      tokens.push({ type: TokenType.Number, value, line: startLine, col: startCol });
      continue;
    }

    // 식별자 / 키워드
    if (isIdentStart(ch)) {
      let value = '';
      while (i < n && isIdentPart(input[i])) value += advance();
      const lower = value.toLowerCase();
      tokens.push({
        type: KEYWORDS.has(lower) ? TokenType.Keyword : TokenType.Ident,
        value: KEYWORDS.has(lower) ? lower : value,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    // 단일 구두점
    const punct: Record<string, TokenType> = {
      '{': TokenType.LBrace,
      '}': TokenType.RBrace,
      '(': TokenType.LParen,
      ')': TokenType.RParen,
      ';': TokenType.Semicolon,
      '.': TokenType.Dot,
      ',': TokenType.Comma,
    };
    if (punct[ch] !== undefined) {
      advance();
      tokens.push({ type: punct[ch], value: ch, line: startLine, col: startCol });
      continue;
    }

    // 알 수 없는 문자
    throw makeLexError(`Unexpected character '${ch}'`, startLine, startCol);
  }

  tokens.push({ type: TokenType.EOF, value: '', line, col });
  return tokens;
}

// line:col 을 가진 어휘 오류 객체 생성
export interface LexError extends Error {
  line: number;
  col: number;
}

function makeLexError(message: string, line: number, col: number): LexError {
  const err = new Error(`${message} (line ${line}, col ${col})`) as LexError;
  err.line = line;
  err.col = col;
  return err;
}
