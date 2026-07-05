// 이름→id 해석기(단일 진실). 모든 커맨드의 주소지정은 반드시 이 유틸을 거친다.
// 중복 구현 금지 — resolveTable / resolveColumn 만이 식별자 해석 채널이다.
import type { StoreState } from '@/store/index';
import type { Table, Column } from '@/types/schema';

// 헤드리스 store 계약(vanilla zustand). 리드가 plugin-entry 에서 실제 store 를 주입한다.
export interface ErdStore {
  getState(): StoreState;
  setState(partial: Partial<StoreState> | ((s: StoreState) => void), replace?: boolean): void;
}

// 해석 성공/실패 결과. 실패 시 사용자/LLM 이 바로 고칠 수 있게 단서를 동봉한다.
export type ResolveResult =
  | { ok: true; id: string }
  | { ok: false; code: string; message: string; did_you_mean?: string[]; candidates?: string[] };

// Levenshtein 편집거리 — 오타 근접 후보 산출용(헤드리스, 순수함수).
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// arg 와 가까운 이름 후보(거리 오름차순, 상위 N). 임계: 편집거리 ≤ max(2, len/3).
function nearMatches(arg: string, names: string[], limit = 3): string[] {
  const lowered = arg.toLowerCase();
  const threshold = Math.max(2, Math.floor(arg.length / 3));
  return names
    .map((name) => ({ name, d: editDistance(lowered, name.toLowerCase()) }))
    .filter((x) => x.d <= threshold || x.name.toLowerCase().includes(lowered))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.name);
}

// 이름 또는 id 로 테이블을 찾는다.
// - 이름 정확 일치(유일) → id
// - 동명 모호 → candidates(해당 id 들)
// - 이름 미스 → id 폴백
// - 전부 실패 → did_you_mean(근접 이름)
export function resolveTable(store: ErdStore, arg: string): ResolveResult {
  if (!arg || typeof arg !== 'string') {
    return { ok: false, code: 'INVALID_INPUT', message: 'table identifier required' };
  }
  const tables = store.getState().tables;
  const all = Object.values(tables);

  // 1) 이름 정확 일치(대소문자 무시).
  const byName = all.filter((t) => t.name.toLowerCase() === arg.toLowerCase());
  if (byName.length === 1) return { ok: true, id: byName[0].id };
  if (byName.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS',
      message: `ambiguous table name '${arg}' (${byName.length} matches)`,
      candidates: byName.map((t) => t.id),
    };
  }

  // 2) id 폴백.
  if (tables[arg]) return { ok: true, id: arg };

  // 3) 근접 후보.
  const names = all.map((t) => t.name);
  const dym = nearMatches(arg, names);
  return {
    ok: false,
    code: 'NOT_FOUND',
    message: `table not found: '${arg}'`,
    ...(dym.length > 0 ? { did_you_mean: dym } : {}),
  };
}

// 컬럼 이름/ id 해석(테이블 컨텍스트 내). 단일 진실 — 별도 구현 금지.
export function resolveColumn(table: Table, arg: string): ResolveResult {
  if (!arg || typeof arg !== 'string') {
    return { ok: false, code: 'INVALID_INPUT', message: 'column identifier required' };
  }
  const byName = table.columns.filter((c) => c.name.toLowerCase() === arg.toLowerCase());
  if (byName.length === 1) return { ok: true, id: byName[0].id };
  if (byName.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS',
      message: `ambiguous column name '${arg}' in '${table.name}'`,
      candidates: byName.map((c) => c.id),
    };
  }
  const byId = table.columns.find((c) => c.id === arg);
  if (byId) return { ok: true, id: byId.id };

  const dym = nearMatches(arg, table.columns.map((c) => c.name));
  return {
    ok: false,
    code: 'NOT_FOUND',
    message: `column not found: '${arg}' in '${table.name}'`,
    ...(dym.length > 0 ? { did_you_mean: dym } : {}),
  };
}

// 테이블 객체를 이름/ id 로 직접 얻는 헬퍼(해석 + 조회 결합). 실패 시 결과 그대로 반환.
export function getTable(
  store: ErdStore,
  arg: string,
): { ok: true; table: Table; id: string } | Extract<ResolveResult, { ok: false }> {
  const r = resolveTable(store, arg);
  if (!r.ok) return r;
  const table = store.getState().tables[r.id];
  if (!table) return { ok: false, code: 'NOT_FOUND', message: `table not found: '${arg}'` };
  return { ok: true, table, id: r.id };
}

// 컬럼 객체를 얻는 헬퍼.
export function getColumn(
  table: Table,
  arg: string,
): { ok: true; column: Column; id: string } | Extract<ResolveResult, { ok: false }> {
  const r = resolveColumn(table, arg);
  if (!r.ok) return r;
  const column = table.columns.find((c) => c.id === r.id)!;
  return { ok: true, column, id: r.id };
}
