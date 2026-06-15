import type { ERDSchema } from '@/types/schema';

// 변환 방향: parse(외부 포맷 → 스키마), generate(스키마 → 외부 포맷), 양방향이면 both
export type ConverterDirection = 'parse' | 'generate' | 'both';

// parse 결과: 스키마 + 미지원 문법 경고 목록
export interface ParseResult {
  schema: ERDSchema;
  warnings: string[];
}

// 포맷 변환기 인터페이스.
// parse / generate 는 방향에 따라 선택적으로 존재한다(direction 으로 보장 계약).
export interface Converter {
  id: string;
  direction: ConverterDirection;
  // 외부 포맷 문자열 → ERDSchema(+경고). 'parse' | 'both' 일 때 존재.
  parse?(input: string): ParseResult;
  // ERDSchema → 외부 포맷 문자열. 'generate' | 'both' 일 때 존재.
  generate?(schema: ERDSchema): string;
}

// 등록된 변환기 레지스트리. id → Converter.
const registry = new Map<string, Converter>();

// 변환기를 레지스트리에 등록(중복 id 는 덮어쓴다 — 단일 진실 유지).
export function registerConverter(converter: Converter): void {
  registry.set(converter.id, converter);
}

// id 로 변환기 조회. 없으면 undefined.
export function getConverter(id: string): Converter | undefined {
  return registry.get(id);
}

// 등록된 모든 변환기 목록.
export function listConverters(): Converter[] {
  return [...registry.values()];
}

// 레지스트리 단일 진실 객체(고수준 API).
export const converterRegistry = {
  register: registerConverter,
  get: getConverter,
  list: listConverters,
};
