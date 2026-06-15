// .mig DSL 공개 API — DB-비종속 정본 텍스트 ↔ Operation[].
// 헤드리스(DOM/React/Pixi 무관).

import type { Operation } from '../types';
import { parse } from './parser';
import type { ParseError } from './parser';
import { serialize } from './serializer';
import type { SerializeOptions } from './serializer';

export { tokenize, TokenType } from './tokenizer';
export type { Token } from './tokenizer';
export { parse } from './parser';
export type { ParseResult, ParseError } from './parser';
export { serialize } from './serializer';
export type { SerializeOptions } from './serializer';

export interface ParseMigResult {
  ops: Operation[]; // up 블록 정본 작업
  downOps: Operation[]; // down 블록(있으면)
  warnings: string[];
}

// 텍스트 → 정본 ops. 문법 오류는 line:col 을 가진 Error 로 throw.
export function parseMig(text: string): ParseMigResult {
  const { ops, downOps, warnings } = parse(text);
  return { ops, downOps, warnings };
}

// Operation[] → 정규형 .mig 텍스트(down 미기재 시 inverse 자동 파생).
export function serializeMig(ops: Operation[], opts: SerializeOptions = {}): string {
  return serialize(ops, opts);
}

export interface LintError {
  line: number;
  col: number;
  message: string;
}

// 텍스트를 검증해 throw 대신 에러 목록으로 보고. 정상이면 빈 배열.
export function lintMig(text: string): { errors: LintError[] } {
  try {
    parse(text);
    return { errors: [] };
  } catch (e) {
    const err = e as ParseError;
    const line = typeof err.line === 'number' ? err.line : 1;
    const col = typeof err.col === 'number' ? err.col : 1;
    // 메시지에서 위치 접미사 제거(중복 표기 방지)
    const message = (err.message ?? 'parse error').replace(/\s*\(line \d+, col \d+\)\s*$/, '');
    return { errors: [{ line, col, message }] };
  }
}
