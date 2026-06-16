// 헤드리스 커맨드 카탈로그 — store mutation 의 얇은 래퍼.
// 모든 핸들러는 이름 기반 주소지정 + 멱등(ifNotExists/ifExists/noop) + {ok,error} 규약을 따른다.
// store 접근은 vanilla zustand(getState/setState). 실제 store 주입은 리드가 plugin-entry 에서 한다.
import type { ErdStore } from './resolve';
import { resolveTable, resolveColumn, getTable } from './resolve';
import type { ERDSchema, Table, Column, Relationship, RelationType, ReferentialAction } from '@/types/schema';
import { validateSchema } from '@/features/validation';
import { computeAutoLayout } from '@/features/layout';
import { generateId } from '@/lib/id';
import { getDialect, type DialectId } from '@/features/db/dialect/registry';
import { generateDbml, parseDbml, generatePrisma, parsePrisma } from '@/features/convert';
import { generateMermaid, parseMermaid } from '@/features/mermaid';
import { parseMig, serializeMig, lintMig } from '@/features/migration/mig-dsl';
import { applyOperation } from '@/features/migration/operations';
import { getSQLGenerator } from '@/features/migration/sql-generator';
import type { Operation } from '@/features/migration/types';
import { diffSchemas } from '@/features/migration/diff';

// soksak fs API 의 최소 표면(파일 기반 마이그레이션용). "fs:read"/"fs:write" 권한이 있을 때만 주입된다.
// readText: offset 지정 시 증분 tail. list: meta=true 면 자식 modified(unix 초) 동봉.
interface PluginFs {
  readText?: (path: string, offset?: number) => Promise<{ text: string; truncated: boolean; totalBytes: number }>;
  writeText?: (path: string, content: string) => Promise<void>;
  list?: (path: string, opts?: { meta?: boolean }) => Promise<unknown>;
}

// soksak ctx 의 최소 표면(커맨드 등록 + 구독 폐기 수집 + 선택적 fs).
interface PluginContext {
  subscriptions: Array<{ dispose(): void }>;
  app: {
    commands?: {
      register(
        name: string,
        spec: { description: string; params?: Record<string, unknown>; handler: (params: any) => Promise<any> },
      ): { dispose(): void };
    };
    fs?: PluginFs;
  };
}

type Ok = { ok: true; [k: string]: unknown };
type Err = { ok: false; error: string; [k: string]: unknown };
type CmdResult = Ok | Err;

// store 의 tables/relationships 를 ERDSchema 로 합성(layers 는 헤드리스에서 비움).
function snapshotSchema(store: ErdStore): ERDSchema {
  const s = store.getState();
  return { tables: s.tables, relationships: s.relationships, layers: {} };
}

// 컬럼 요약(compact get-schema·토큰 절약용).
function compactColumn(c: Column) {
  const flags: string[] = [];
  if (c.isPrimaryKey) flags.push('PK');
  if (c.isUnique) flags.push('UQ');
  if (!c.nullable) flags.push('NN');
  if (c.autoIncrement) flags.push('AI');
  return { name: c.name, type: c.dataType, flags };
}

function compactTable(t: Table) {
  return { name: t.name, columns: t.columns.map(compactColumn) };
}

// ── 스냅샷 유틸(batch atomic 복원용) ──────────────────────────────────────────
interface StoreSnapshot {
  tables: Record<string, Table>;
  relationships: Record<string, Relationship>;
}

function deepSnapshot(store: ErdStore): StoreSnapshot {
  const s = store.getState();
  return {
    tables: structuredClone(s.tables),
    relationships: structuredClone(s.relationships),
  };
}

function restoreSnapshot(store: ErdStore, snap: StoreSnapshot): void {
  // loadProject 로 tables/relationships 를 통째 교체(원자적 복원).
  store.getState().loadProject({
    tables: structuredClone(snap.tables),
    relationships: structuredClone(snap.relationships),
  });
}

// ── import 적재 유틸 ─────────────────────────────────────────────────────────
// 파싱된 스키마를 store 에 싣는다.
// - mode='replace': 기존 스키마를 비우고(clearSchema) 적재.
// - mode='merge'(기본): 기존 위에 합침(loadSchema = Object.assign).
// 적재된 테이블/관계 수를 added 로 반환(라운드트립 단언용).
function loadParsedSchema(
  store: ErdStore,
  parsed: ERDSchema,
  mode: 'merge' | 'replace',
): { tables: number; relationships: number } {
  if (mode === 'replace') store.getState().clearSchema();
  store.getState().loadSchema(parsed.tables, parsed.relationships);
  return {
    tables: Object.keys(parsed.tables).length,
    relationships: Object.keys(parsed.relationships).length,
  };
}

// ── 파일 기반 마이그레이션 유틸(.mig) ─────────────────────────────────────────
// 빈 ERDSchema(베이스라인 fold 시작점).
const EMPTY_SCHEMA: ERDSchema = { tables: {}, relationships: {}, layers: {} };

// 2자리 zero-pad.
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// 파일명 타임스탬프 컴포넌트(로컬 시각). YYYYMMDD / HHIISS.
function nowStamp(d: Date = new Date()): { date: string; time: string } {
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return { date, time };
}

// 마이그레이션 파일명. NNN = 기존 .mig 개수+1(3자리 zero-pad).
function migFilename(existingCount: number, d: Date = new Date()): string {
  const { date, time } = nowStamp(d);
  const seq = String(existingCount + 1).padStart(3, '0');
  return `migration_${date}_${time}_${seq}.mig`;
}

// 경로 결합(절대 dir + 파일명). 중복 슬래시 방지.
function joinPath(dir: string, file: string): string {
  return dir.endsWith('/') ? `${dir}${file}` : `${dir}/${file}`;
}

// name 메타 + up 블록 → .mig 파일 내용(down 은 serializeMig 가 자동 파생).
// name 은 선행 주석(-- name: …)으로 기록 — parseMig 가 주석을 흡수하므로 라운드트립 무손실.
function migFileContent(name: string | undefined, ops: Operation[]): string {
  const body = serializeMig(ops);
  return name ? `-- name: ${name}\n${body}` : body;
}

// .mig 텍스트에서 name 메타 추출(없으면 undefined).
function parseMigName(text: string): string | undefined {
  const m = text.match(/^\s*--\s*name:\s*(.+?)\s*$/m);
  return m ? m[1] : undefined;
}

// fs.list 결과(ChildListing { root, children:[{name,dir,modified?}] })에서 .mig 파일명만 추출.
function extractMigNames(listing: unknown): string[] {
  const children = (listing as { children?: Array<{ name?: string; dir?: boolean }> } | null)?.children ?? [];
  return children
    .filter((c) => c && c.dir !== true && typeof c.name === 'string' && c.name.endsWith('.mig'))
    .map((c) => c.name as string)
    .sort(); // 파일명 = 시간순 정렬 키(YYYYMMDD_HHIISS_NNN)
}

// 에러 메시지 정규화. Tauri invoke 는 문자열로 reject 하므로(Error 아님) (e as Error).message
// 가 undefined 가 된다 → 문자열/임의 throw 까지 안전하게 문자열화한다.
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// id(파일명) 해석 — 확장자 유무 무관. dir 의 실제 .mig 목록에서 매칭한다.
//   1) 정확 일치(id 그대로)  2) id + '.mig'  3) 확장자 제거 후 basename 일치
// 못 찾으면 null. fs.list 권한 없으면 입력 id 를 그대로 신뢰(폴백).
async function resolveMigId(fs: PluginFs, dir: string, id: string): Promise<string | null> {
  if (!fs.list) return id; // list 불가 → 입력 그대로(readText 가 최종 판정)
  let files: string[];
  try {
    files = extractMigNames(await fs.list(dir));
  } catch {
    return id; // 리스팅 실패 → 입력 그대로 폴백
  }
  if (files.includes(id)) return id;
  const withExt = id.endsWith('.mig') ? id : `${id}.mig`;
  if (files.includes(withExt)) return withExt;
  const stem = id.endsWith('.mig') ? id.slice(0, -4) : id;
  const byStem = files.find((f) => f.slice(0, -4) === stem);
  return byStem ?? null;
}

// dir 의 모든 .mig 파일을 이름순으로 파싱 → up ops 를 빈 스키마부터 fold → 마지막 상태.
// 반환: { schema, files(이름순), ops(누적 up ops) }.
async function buildBaseline(
  fs: PluginFs,
  dir: string,
): Promise<{ schema: ERDSchema; files: string[]; ops: Operation[] }> {
  if (!fs.list || !fs.readText) throw new Error('fs 권한 필요');
  const listing = await fs.list(dir);
  const files = extractMigNames(listing);
  let schema = EMPTY_SCHEMA;
  const ops: Operation[] = [];
  for (const file of files) {
    const { text } = await fs.readText(joinPath(dir, file));
    const { ops: up } = parseMig(text);
    for (const op of up) {
      ops.push(op);
      schema = applyOperation(schema, op);
    }
  }
  return { schema, files, ops };
}

// ── 카탈로그 등록 ────────────────────────────────────────────────────────────
// 각 핸들러는 store 클로저로 정의. soksak 커맨드 규약상 Promise<object> 를 반환한다.
// internal 맵은 batch(apply) 가 다른 커맨드를 재호출하기 위한 호출 가능 핸들러 레지스트리다
// (registerCommands 호출마다 새로 만들어 store 별 격리 — 모듈 전역 공유 금지).
export function registerCommands(ctx: PluginContext, store: ErdStore): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);

  const internal = new Map<string, (params: any) => Promise<CmdResult>>();

  // 등록 + 구독 수집 + internal 적재를 한 번에.
  const add = (
    name: string,
    description: string,
    handler: (params: any) => CmdResult | Promise<CmdResult>,
    params?: Record<string, unknown>,
  ) => {
    const wrapped = async (p: any): Promise<CmdResult> => handler(p ?? {});
    internal.set(name, wrapped);
    ctx.subscriptions.push(register(name, { description, params, handler: wrapped }));
  };

  // ── Introspection ──────────────────────────────────────────────────────────
  add('get-schema', '스키마 조회(mode: compact 요약 | full 원본)', (p) => {
    const mode = p.mode === 'full' ? 'full' : 'compact';
    if (mode === 'full') {
      return { ok: true, mode, schema: snapshotSchema(store) };
    }
    const tablesMap = store.getState().tables;
    const tables = Object.values(tablesMap).map(compactTable);
    const relationships = Object.values(store.getState().relationships).map((r) => ({
      type: r.type,
      source: tablesMap[r.sourceTableId]?.name ?? r.sourceTableId,
      target: tablesMap[r.targetTableId]?.name ?? r.targetTableId,
    }));
    return { ok: true, mode, tables, relationships };
  }, {
    mode: { type: 'string', enum: ['compact', 'full'], description: '조회 형식(compact 요약 | full 원본)', default: 'compact' },
  });

  add('list-tables', '테이블 목록(id/name/컬럼수)', () => {
    const tables = Object.values(store.getState().tables).map((t) => ({
      id: t.id,
      name: t.name,
      columnCount: t.columns.length,
    }));
    return { ok: true, tables };
  });

  add('get-table', '테이블 단건 조회(이름/ id)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, table: r.table };
  }, {
    table: { type: 'string', required: true, description: '테이블 이름 또는 id' },
  });

  add('get-columns', '테이블 컬럼 목록', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, columns: r.table.columns };
  }, {
    table: { type: 'string', required: true, description: '테이블 이름 또는 id' },
  });

  add('list-relationships', '관계 목록', () => {
    const relationships = Object.values(store.getState().relationships);
    return { ok: true, relationships };
  });

  add('validate', '스키마 무결성 검사(이슈 배열)', () => {
    const issues = validateSchema(snapshotSchema(store));
    return { ok: true, issues };
  });

  add('stats', '스키마 통계(테이블/컬럼/관계 수)', () => {
    const tables = Object.values(store.getState().tables);
    const columnCount = tables.reduce((acc, t) => acc + t.columns.length, 0);
    return {
      ok: true,
      stats: {
        tableCount: tables.length,
        columnCount,
        relationshipCount: Object.keys(store.getState().relationships).length,
      },
    };
  });

  add('diff', '기준 스키마(from)와 현재의 added/removed 테이블 보고', (p) => {
    const from = p.from as ERDSchema | undefined;
    if (!from || typeof from !== 'object' || !from.tables) {
      return { ok: false, error: 'diff requires { from: ERDSchema }' };
    }
    const fromNames = new Set(Object.values(from.tables).map((t) => t.name));
    const nowNames = new Set(Object.values(store.getState().tables).map((t) => t.name));
    const addedTables = [...nowNames].filter((n) => !fromNames.has(n));
    const removedTables = [...fromNames].filter((n) => !nowNames.has(n));
    return { ok: true, diff: { addedTables, removedTables } };
  }, {
    from: { type: 'json', required: true, description: '기준 스키마(ERDSchema: { tables, relationships, layers })' },
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  add('create-table', '테이블 생성(ifNotExists 멱등)', (p) => {
    if (!p.name || typeof p.name !== 'string') return { ok: false, error: 'name required' };
    const existing = Object.values(store.getState().tables).find(
      (t) => t.name.toLowerCase() === p.name.toLowerCase(),
    );
    if (existing) {
      if (p.ifNotExists) return { ok: true, id: existing.id, noop: true };
      return { ok: false, error: `table already exists: '${p.name}'` };
    }
    const id = store.getState().addTable({
      name: p.name,
      columns: p.columns,
      comment: p.comment,
      schema: p.schema,
    });
    return { ok: true, id };
  }, {
    name: { type: 'string', required: true, description: '생성할 테이블 이름' },
    columns: { type: 'json', description: '초기 컬럼 정의 배열(Column[] 부분 형태)' },
    comment: { type: 'string', description: '테이블 주석' },
    schema: { type: 'string', description: '소속 스키마(네임스페이스)' },
    ifNotExists: { type: 'boolean', description: '동명 테이블이 있으면 noop(멱등)' },
  });

  add('rename-table', '테이블 이름 변경', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== 'string') return { ok: false, error: 'name required' };
    store.getState().updateTable(r.id, { name: p.name });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    name: { type: 'string', required: true, description: '변경할 새 이름' },
  });

  add('drop-table', '테이블 삭제(ifExists 멱등)', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) {
      if (p.ifExists) return { ok: true, noop: true };
      return r;
    }
    store.getState().removeTable(r.id);
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: '삭제할 테이블 이름 또는 id' },
    ifExists: { type: 'boolean', description: '없으면 noop(멱등)' },
  });

  add('add-column', '컬럼 추가(ifNotExists 멱등)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== 'string') return { ok: false, error: 'name required' };
    const exists = r.table.columns.find((c) => c.name.toLowerCase() === p.name.toLowerCase());
    if (exists) {
      if (p.ifNotExists) return { ok: true, columnId: exists.id, noop: true };
      return { ok: false, error: `column already exists: '${p.name}'` };
    }
    store.getState().addColumn(r.id, {
      name: p.name,
      dataType: p.dataType,
      nullable: p.nullable,
      isPrimaryKey: p.isPrimaryKey,
      isUnique: p.isUnique,
      autoIncrement: p.autoIncrement,
      defaultValue: p.defaultValue,
      comment: p.comment,
      length: p.length,
    });
    // addColumn 은 id 를 반환하지 않으므로 방금 추가된 컬럼을 이름으로 회수.
    const created = store.getState().tables[r.id].columns.find((c) => c.name === p.name);
    return { ok: true, columnId: created?.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    name: { type: 'string', required: true, description: '추가할 컬럼 이름' },
    dataType: { type: 'string', description: '데이터 타입(예: INT, VARCHAR)' },
    nullable: { type: 'boolean', description: 'NULL 허용 여부' },
    isPrimaryKey: { type: 'boolean', description: 'PK 여부' },
    isUnique: { type: 'boolean', description: 'UNIQUE 여부' },
    autoIncrement: { type: 'boolean', description: '자동 증가 여부' },
    defaultValue: { type: 'string', description: '기본값' },
    comment: { type: 'string', description: '컬럼 주석' },
    length: { type: 'number', description: '길이(예: VARCHAR(n))' },
    ifNotExists: { type: 'boolean', description: '동명 컬럼이 있으면 noop(멱등)' },
  });

  add('update-column', '컬럼 속성 변경', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const updates: Partial<Column> = {};
    for (const k of ['name', 'dataType', 'nullable', 'isPrimaryKey', 'isUnique', 'autoIncrement', 'defaultValue', 'comment', 'length', 'precision', 'scale'] as const) {
      if (p[k] !== undefined) (updates as any)[k] = p[k];
    }
    store.getState().updateColumn(r.id, cr.id, updates);
    return { ok: true, columnId: cr.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    column: { type: 'string', required: true, description: '대상 컬럼 이름 또는 id' },
    name: { type: 'string', description: '변경할 컬럼 이름' },
    dataType: { type: 'string', description: '데이터 타입' },
    nullable: { type: 'boolean', description: 'NULL 허용 여부' },
    isPrimaryKey: { type: 'boolean', description: 'PK 여부' },
    isUnique: { type: 'boolean', description: 'UNIQUE 여부' },
    autoIncrement: { type: 'boolean', description: '자동 증가 여부' },
    defaultValue: { type: 'string', description: '기본값' },
    comment: { type: 'string', description: '컬럼 주석' },
    length: { type: 'number', description: '길이' },
    precision: { type: 'number', description: '정밀도(precision)' },
    scale: { type: 'number', description: '소수 자릿수(scale)' },
  });

  add('drop-column', '컬럼 삭제(ifExists 멱등)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) {
      if (p.ifExists) return { ok: true, noop: true };
      return cr;
    }
    store.getState().removeColumn(r.id, cr.id);
    return { ok: true, columnId: cr.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    column: { type: 'string', required: true, description: '삭제할 컬럼 이름 또는 id' },
    ifExists: { type: 'boolean', description: '없으면 noop(멱등)' },
  });

  add('reorder-columns', '컬럼 순서 재배열(이름/ id 배열)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns)) return { ok: false, error: 'columns array required' };
    const ids: string[] = [];
    for (const arg of p.columns) {
      const cr = resolveColumn(r.table, arg);
      if (!cr.ok) return cr;
      ids.push(cr.id);
    }
    store.getState().reorderColumns(r.id, ids);
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    columns: { type: 'json', required: true, description: '재배열할 컬럼 이름/ id 배열(원하는 순서)' },
  });

  add('set-pk', '컬럼 PK 설정/해제', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === undefined ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, value ? { isPrimaryKey: true, nullable: false } : { isPrimaryKey: false });
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    column: { type: 'string', required: true, description: '대상 컬럼 이름 또는 id' },
    value: { type: 'boolean', description: 'PK 설정(true, 기본)/해제(false)' },
  });

  add('set-unique', '컬럼 UNIQUE 설정/해제', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === undefined ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, { isUnique: value });
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    column: { type: 'string', required: true, description: '대상 컬럼 이름 또는 id' },
    value: { type: 'boolean', description: 'UNIQUE 설정(true, 기본)/해제(false)' },
  });

  add('add-index', '인덱스 추가(컬럼 이름/ id 배열, ifNotExists 멱등)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns) || p.columns.length === 0) {
      return { ok: false, error: 'columns array required' };
    }
    const columnIds: string[] = [];
    for (const arg of p.columns) {
      const cr = resolveColumn(r.table, arg);
      if (!cr.ok) return cr;
      columnIds.push(cr.id);
    }
    const name = p.name ?? `idx_${r.table.name}_${columnIds.length}`;
    if (p.ifNotExists && r.table.indexes.some((i) => i.name === name)) {
      return { ok: true, noop: true };
    }
    const indexId = generateId();
    store.getState().updateTable(r.id, {
      indexes: [...r.table.indexes, { id: indexId, name, columnIds, unique: !!p.unique, type: p.type }],
    });
    return { ok: true, indexId };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    columns: { type: 'json', required: true, description: '인덱스 구성 컬럼 이름/ id 배열' },
    name: { type: 'string', description: '인덱스 이름(생략 시 자동 생성)' },
    unique: { type: 'boolean', description: 'UNIQUE 인덱스 여부' },
    type: { type: 'string', description: '인덱스 종류(예: BTREE, HASH)' },
    ifNotExists: { type: 'boolean', description: '동명 인덱스가 있으면 noop(멱등)' },
  });

  add('drop-index', '인덱스 삭제(이름/ id, ifExists 멱등)', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const idx = r.table.indexes.find((i) => i.name === p.index || i.id === p.index);
    if (!idx) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, error: `index not found: '${p.index}'` };
    }
    store.getState().updateTable(r.id, {
      indexes: r.table.indexes.filter((i) => i.id !== idx.id),
    });
    return { ok: true, indexId: idx.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    index: { type: 'string', required: true, description: '삭제할 인덱스 이름 또는 id' },
    ifExists: { type: 'boolean', description: '없으면 noop(멱등)' },
  });

  add('add-relationship', 'FK 관계 추가(source=참조PK·target=FK보유, autoFk 시 FK 컬럼 자동 생성)', (p) => {
    const sr = getTable(store, p.source);
    if (!sr.ok) return sr;
    const tr = getTable(store, p.target);
    if (!tr.ok) return tr;
    const type: RelationType = (p.type as RelationType) ?? '1:N';

    // source 의 PK 컬럼(참조 대상). 없으면 첫 컬럼 폴백.
    const srcPk = sr.table.columns.find((c) => c.isPrimaryKey) ?? sr.table.columns[0];
    if (!srcPk) return { ok: false, error: `source table '${sr.table.name}' has no columns to reference` };

    let targetColumnIds: string[] = [];
    if (Array.isArray(p.targetColumns) && p.targetColumns.length > 0) {
      // 명시 FK 컬럼 사용.
      for (const arg of p.targetColumns) {
        const cr = resolveColumn(tr.table, arg);
        if (!cr.ok) return cr;
        targetColumnIds.push(cr.id);
      }
    } else if (p.autoFk) {
      // autoFk: target 에 <source>_<pk> FK 컬럼을 생성(이미 있으면 재사용).
      const fkName = `${sr.table.name}_${srcPk.name}`;
      const existing = tr.table.columns.find((c) => c.name.toLowerCase() === fkName.toLowerCase());
      let fkId: string;
      if (existing) {
        fkId = existing.id;
      } else {
        store.getState().addColumn(tr.id, {
          name: fkName,
          dataType: srcPk.dataType,
          nullable: type !== '1:1',
          isPrimaryKey: false,
          isUnique: type === '1:1',
          autoIncrement: false,
        });
        fkId = store.getState().tables[tr.id].columns.find((c) => c.name === fkName)!.id;
      }
      targetColumnIds = [fkId];
    }

    const rel: Omit<Relationship, 'id'> = {
      name: p.name,
      sourceTableId: sr.id,
      targetTableId: tr.id,
      type,
      sourceColumnIds: [srcPk.id],
      targetColumnIds,
      onDelete: (p.onDelete as ReferentialAction) ?? 'NO ACTION',
      onUpdate: (p.onUpdate as ReferentialAction) ?? 'NO ACTION',
    };
    const id = store.getState().addRelationship(rel);
    return { ok: true, id };
  }, {
    source: { type: 'string', required: true, description: '참조 대상(PK 보유) 테이블 이름 또는 id' },
    target: { type: 'string', required: true, description: 'FK 보유 테이블 이름 또는 id' },
    type: { type: 'string', enum: ['1:1', '1:N', 'N:M'], description: '관계 카디널리티', default: '1:N' },
    targetColumns: { type: 'json', description: 'target 의 FK 컬럼 이름/ id 배열(명시 시 autoFk 무시)' },
    autoFk: { type: 'boolean', description: 'target 에 <source>_<pk> FK 컬럼 자동 생성' },
    name: { type: 'string', description: '관계(제약) 이름' },
    onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON DELETE 동작', default: 'NO ACTION' },
    onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON UPDATE 동작', default: 'NO ACTION' },
  });

  add('update-relationship', '관계 속성 변경', (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      return { ok: false, error: `relationship not found: '${p.id}'` };
    }
    const updates: Partial<Relationship> = {};
    for (const k of ['name', 'type', 'onDelete', 'onUpdate', 'lineStyle'] as const) {
      if (p[k] !== undefined) (updates as any)[k] = p[k];
    }
    store.getState().updateRelationship(p.id, updates);
    return { ok: true, id: p.id };
  }, {
    id: { type: 'string', required: true, description: '대상 관계 id' },
    name: { type: 'string', description: '관계 이름' },
    type: { type: 'string', enum: ['1:1', '1:N', 'N:M'], description: '관계 카디널리티' },
    onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON DELETE 동작' },
    onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON UPDATE 동작' },
    lineStyle: { type: 'string', enum: ['dashed', 'solid'], description: '관계 선 스타일' },
  });

  add('drop-relationship', '관계 삭제(ifExists 멱등)', (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, error: `relationship not found: '${p.id}'` };
    }
    store.getState().removeRelationship(p.id);
    return { ok: true, id: p.id };
  }, {
    id: { type: 'string', required: true, description: '삭제할 관계 id' },
    ifExists: { type: 'boolean', description: '없으면 noop(멱등)' },
  });

  add('set-color', '테이블 색상 설정(null 로 해제)', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    store.getState().updateTable(r.id, { color: p.color ?? undefined });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    color: { type: 'string', description: '색상(예: #RRGGBB). 생략/null 이면 해제' },
  });

  // ── Batch ─────────────────────────────────────────────────────────────────
  // apply: ops 를 순차 실행. atomic(기본 true)이면 시작 시점 스냅샷을 떠두고 실패 시 전체 복원.
  add('apply', '배치 실행({ops,atomic,title}). atomic 부분 실패 시 스냅샷 복원', async (p) => {
    const ops = p.ops as Array<{ command: string; params?: any }> | undefined;
    if (!Array.isArray(ops)) return { ok: false, error: 'ops array required' };
    const atomic = p.atomic !== false;

    const before = atomic ? deepSnapshot(store) : null;

    const results: CmdResult[] = [];
    let failedAt = -1;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const h = internal.get(op.command);
      let res: CmdResult;
      if (!h) {
        res = { ok: false, error: `unknown command in batch: '${op.command}'` };
      } else {
        res = await h(op.params ?? {});
      }
      results.push(res);
      if (!res.ok && failedAt === -1) failedAt = i;
      if (!res.ok && atomic) break;
    }

    const anyFailed = results.some((r) => !r.ok);
    if (anyFailed && atomic && before) {
      restoreSnapshot(store, before);
      return {
        ok: false,
        error: `batch failed at op ${failedAt}: ${(results[failedAt] as Err).error}`,
        failedAt,
        rolledBack: true,
        results,
      };
    }
    if (anyFailed) {
      return { ok: false, error: 'batch completed with failures', failedAt, results };
    }
    // 성공 시 마이그레이션 버전으로 커밋(슬라이스 표면이 있을 때만).
    if (p.title && typeof store.getState().commitVersion === 'function') {
      try { store.getState().commitVersion(p.title); } catch { /* 헤드리스 안전 무시 */ }
    }
    return { ok: true, results };
  }, {
    ops: { type: 'json', required: true, description: '실행할 작업 배열([{ command, params }])' },
    atomic: { type: 'boolean', description: '부분 실패 시 시작 스냅샷으로 전체 복원(기본 true)', default: true },
    title: { type: 'string', description: '성공 시 커밋할 마이그레이션 제목' },
  });

  add('undo', '마지막 미커밋 작업 되돌리기(마이그레이션 슬라이스 기반)', () => {
    const fn = store.getState().undoLastOperation;
    if (typeof fn !== 'function') return { ok: false, error: 'undo not available' };
    const inverse = fn();
    return { ok: true, inverse };
  });

  // redo 는 마이그레이션 슬라이스에 아직 표면이 없다 → stub(P3/P4 통합).
  // TODO(P3/P4): migration-slice 에 redo 표면 추가 후 배선. 현재는 noop.
  add('redo', '되돌린 작업 다시 적용(P3/P4 통합 예정 stub)', () => {
    return { ok: true, noop: true, todo: 'redo wiring deferred to P3/P4' };
  });

  // ── Layout ────────────────────────────────────────────────────────────────
  add('auto-layout', '자동 배치(dagre 기반 좌표 계산·적용)', (p) => {
    const schema = snapshotSchema(store);
    const positions = computeAutoLayout(schema, store.getState().nodePositions, {
      direction: p.direction ?? 'TB',
    });
    store.getState().setNodePositions(positions);
    return { ok: true, count: Object.keys(positions).length };
  }, {
    direction: { type: 'string', enum: ['TB', 'LR', 'BT', 'RL'], description: '배치 방향(dagre rankdir)', default: 'TB' },
  });

  add('set-position', '테이블 좌표 설정(이름/ id)', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
      return { ok: false, error: 'x and y numbers required' };
    }
    store.getState().setNodePosition(r.id, { x: p.x, y: p.y });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: '대상 테이블 이름 또는 id' },
    x: { type: 'number', required: true, description: 'x 좌표' },
    y: { type: 'number', required: true, description: 'y 좌표' },
  });

  add('get-viewport', '뷰포트 조회', () => {
    return { ok: true, viewport: store.getState().viewport };
  });

  add('set-viewport', '뷰포트 설정(x/y/zoom)', (p) => {
    const v = store.getState().viewport;
    store.getState().setViewport({
      x: typeof p.x === 'number' ? p.x : v.x,
      y: typeof p.y === 'number' ? p.y : v.y,
      zoom: typeof p.zoom === 'number' ? p.zoom : v.zoom,
    });
    return { ok: true, viewport: store.getState().viewport };
  }, {
    x: { type: 'number', description: '뷰포트 x(생략 시 현재 유지)' },
    y: { type: 'number', description: '뷰포트 y(생략 시 현재 유지)' },
    zoom: { type: 'number', description: '줌 배율(생략 시 현재 유지)' },
  });

  add('select', '테이블 선택(이름/ id 배열 → 노드 선택)', (p) => {
    const args: string[] = Array.isArray(p.tables) ? p.tables : [];
    const ids: string[] = [];
    for (const arg of args) {
      const r = resolveTable(store, arg);
      if (!r.ok) return r;
      ids.push(r.id);
    }
    store.getState().setSelectedNodeIds(ids);
    return { ok: true, selected: ids };
  }, {
    tables: { type: 'json', description: '선택할 테이블 이름/ id 배열' },
  });

  add('fit', '뷰포트를 전체 콘텐츠에 맞춤(뷰가 마운트된 경우만 — 헤드리스엔 no-op)', () => {
    // 뷰(PixiERDCanvas)가 마운트 시 store 에 등록하는 doFitView 를 호출한다. 미마운트면 null →
    // applied:false(정상 — 헤드리스 동작이라 좌표/뷰포트는 그대로). 뷰 열림 후 호출하면 테이블이 보인다.
    const fit = store.getState().fitViewFn;
    if (!fit) return { ok: true, applied: false, reason: 'view not mounted' };
    fit();
    return { ok: true, applied: true, viewport: store.getState().viewport };
  });

  add('get-render-state', '렌더/뷰 상태(마운트 여부·노드수·뷰포트 — 뷰 E2E 단언용)', () => {
    const s = store.getState();
    return {
      ok: true,
      mounted: s.fitViewFn != null, // 뷰의 Pixi 캔버스가 fit 함수를 등록 = 마운트됨
      tableCount: Object.keys(s.tables).length,
      relationshipCount: Object.keys(s.relationships).length,
      positionedCount: Object.keys(s.nodePositions).length,
      collapsedCount: Object.values(s.collapsedNodes).filter(Boolean).length,
      selectedCount: s.selectedNodeIds.length,
      viewport: s.viewport,
    };
  });

  // ── import / export(멀티-DB Dialect + 포맷 변환기 배선) ──────────────────────
  // export: 현재 스키마 → 외부 포맷 문자열. import: 외부 포맷 → 파싱 후 store 적재.
  // 파싱 실패/엔진 throw 는 {ok:false,error} 로 흡수한다.

  add('export-sql', 'SQL DDL 생성(dialect 선택: sqlite/mysql/postgresql)', (p) => {
    const dialect = (p.dialect as DialectId) ?? 'mysql';
    try {
      const sql = getDialect(dialect).generate(snapshotSchema(store));
      return { ok: true, sql };
    } catch (e) {
      return { ok: false, error: `export-sql failed: ${(e as Error).message}` };
    }
  }, {
    dialect: { type: 'string', enum: ['sqlite', 'mysql', 'postgresql'], description: '대상 DB dialect', default: 'mysql' },
  });

  add('import-sql', 'SQL DDL 파싱 후 적재(dialect 선택, mode: merge/replace)', (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, error: 'text required' };
    const dialect = (p.dialect as DialectId) ?? 'mysql';
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = getDialect(dialect).parse(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-sql failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: '파싱할 SQL DDL 텍스트' },
    dialect: { type: 'string', enum: ['sqlite', 'mysql', 'postgresql'], description: '입력 DDL 의 dialect', default: 'mysql' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge(기존 위 합침) | replace(기존 비우고 적재)', default: 'merge' },
  });

  add('export-dbml', 'DBML 생성(현재 스키마)', () => {
    try {
      return { ok: true, dbml: generateDbml(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-dbml failed: ${(e as Error).message}` };
    }
  });

  add('import-dbml', 'DBML 파싱 후 적재(mode: merge/replace)', (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, error: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = parseDbml(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-dbml failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: '파싱할 DBML 텍스트' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge(기존 위 합침) | replace(기존 비우고 적재)', default: 'merge' },
  });

  add('export-prisma', 'Prisma 스키마 생성(현재 스키마)', () => {
    try {
      return { ok: true, prisma: generatePrisma(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-prisma failed: ${(e as Error).message}` };
    }
  });

  add('import-prisma', 'Prisma 스키마 파싱 후 적재(mode: merge/replace)', (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, error: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = parsePrisma(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, error: `import-prisma failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: '파싱할 Prisma 스키마 텍스트' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge(기존 위 합침) | replace(기존 비우고 적재)', default: 'merge' },
  });

  add('export-mermaid', 'Mermaid erDiagram 생성(현재 스키마)', () => {
    try {
      return { ok: true, mermaid: generateMermaid(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, error: `export-mermaid failed: ${(e as Error).message}` };
    }
  });

  add('import-mermaid', 'Mermaid erDiagram 파싱 후 적재(mode: merge/replace)', (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, error: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      // parseMermaid 는 ERDSchema 를 직접 반환(다른 파서와 달리 warnings 래퍼 없음) → warnings=[].
      const schema = parseMermaid(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings: [] };
    } catch (e) {
      return { ok: false, error: `import-mermaid failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: '파싱할 Mermaid erDiagram 텍스트' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge(기존 위 합침) | replace(기존 비우고 적재)', default: 'merge' },
  });

  // ── migration(파일 기반 .mig 마이그레이션) ───────────────────────────────────
  // write 계열은 dir(절대경로) 필수 — 헤드리스·명시적(프로젝트 git 관리).
  // fs 는 ctx.app.fs 가 있을 때만(권한 게이트). 없으면 {ok:false,error:"fs 권한 필요"}.
  const fs = ctx.app.fs;

  // fs 게이트 — read/write 필요한 커맨드의 공통 가드.
  const needFs = (): Err | null => (fs ? null : { ok: false, error: 'fs 권한 필요' });
  const requireDir = (p: any): Err | null =>
    typeof p.dir === 'string' && p.dir.length > 0 ? null : { ok: false, error: 'dir(절대경로) required' };

  add('migration-status', '대기 변경 미리보기(베이스라인 vs 현재 working store diff)', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    try {
      const { schema: baseline, files } = await buildBaseline(fs!, p.dir);
      const ops = diffSchemas(baseline, snapshotSchema(store));
      return {
        ok: true,
        applied: files.length,
        appliedFiles: files,
        pendingOps: ops.length,
        ops,
        clean: ops.length === 0,
      };
    } catch (e) {
      return { ok: false, error: `migration-status 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
  });

  add('migration-generate', '베이스라인→현재 diff 로 .mig 생성(confirm 없으면 preview, confirm=true 면 파일 기록)', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    try {
      const { schema: baseline, files } = await buildBaseline(fs!, p.dir);
      const ops = diffSchemas(baseline, snapshotSchema(store));
      if (ops.length === 0) return { ok: true, noop: true };

      const mig = migFileContent(p.name, ops);
      if (!p.confirm) {
        // 미리보기 — 파일 미기록.
        return { ok: true, preview: true, mig, ops };
      }
      if (!fs!.writeText) return { ok: false, error: 'fs 권한 필요' };
      const filename = migFilename(files.length);
      const path = joinPath(p.dir, filename);
      await fs!.writeText(path, mig);
      return { ok: true, written: true, filename, path, ops };
    } catch (e) {
      return { ok: false, error: `migration-generate 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
    name: { type: 'string', description: '마이그레이션 이름 메타(파일에 -- name: 으로 기록)' },
    confirm: { type: 'boolean', description: 'true 면 파일 기록, 생략 시 미리보기(mig/ops 만)' },
  });

  add('migration-list', '디렉토리의 .mig 파일 목록(이름순)', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.list) return { ok: false, error: 'fs 권한 필요' };
    try {
      const listing = await fs!.list(p.dir);
      const files = extractMigNames(listing);
      return { ok: true, files, count: files.length };
    } catch (e) {
      return { ok: false, error: `migration-list 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
  });

  add('migration-show', '단일 .mig 파일 내용·파싱 결과 조회', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!p.id || typeof p.id !== 'string') return { ok: false, error: 'id(파일명) required' };
    if (!fs!.readText) return { ok: false, error: 'fs 권한 필요' };
    try {
      const file = await resolveMigId(fs!, p.dir, p.id);
      if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
      const { text } = await fs!.readText(joinPath(p.dir, file));
      const { ops, downOps, warnings } = parseMig(text);
      return { ok: true, id: file, name: parseMigName(text), text, ops, downOps, warnings };
    } catch (e) {
      return { ok: false, error: `migration-show 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
    id: { type: 'string', required: true, description: '.mig 파일명(확장자 생략 가능)' },
  });

  add('migration-sql', '단일 .mig 의 up ops → 해당 dialect DDL 생성', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!p.id || typeof p.id !== 'string') return { ok: false, error: 'id(파일명) required' };
    if (!fs!.readText) return { ok: false, error: 'fs 권한 필요' };
    const dialect = (p.dialect as 'mysql' | 'postgresql') ?? 'mysql';
    if (dialect !== 'mysql' && dialect !== 'postgresql') {
      return { ok: false, error: `migration-sql dialect 미지원: '${dialect}'(mysql|postgresql)` };
    }
    try {
      const file = await resolveMigId(fs!, p.dir, p.id);
      if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
      const { text } = await fs!.readText(joinPath(p.dir, file));
      const { ops, downOps } = parseMig(text);
      // mig op[] → DDL: migration sql-generator 가 Operation[] 을 직접 받는다(generateAlter 의
      // SchemaDiff 시그니처와 형태 불일치 → ops 직접 generate 채택).
      const gen = getSQLGenerator(dialect);
      return { ok: true, id: file, dialect, up: gen.generateBatch(ops), down: gen.generateBatch(downOps) };
    } catch (e) {
      return { ok: false, error: `migration-sql 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
    id: { type: 'string', required: true, description: '.mig 파일명(확장자 생략 가능)' },
    dialect: { type: 'string', enum: ['mysql', 'postgresql'], description: '대상 DB dialect', default: 'mysql' },
  });

  add('migration-apply', '.mig 의 up ops 를 working store 에 적용(id 생략 시 dir 전체 fold)', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.readText || !fs!.list) return { ok: false, error: 'fs 권한 필요' };
    try {
      let ops: Operation[];
      if (p.id && typeof p.id === 'string') {
        const file = await resolveMigId(fs!, p.dir, p.id);
        if (!file) return { ok: false, error: `migration not found: '${p.id}'` };
        const { text } = await fs!.readText(joinPath(p.dir, file));
        ops = parseMig(text).ops;
      } else {
        ops = (await buildBaseline(fs!, p.dir)).ops;
      }
      // working store(snapshot)에 fold 후 통째 재적재(replace).
      let schema = snapshotSchema(store);
      for (const op of ops) schema = applyOperation(schema, op);
      loadParsedSchema(store, schema, 'replace');
      return { ok: true, applied: ops.length };
    } catch (e) {
      return { ok: false, error: `migration-apply 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
    id: { type: 'string', description: '.mig 파일명(확장자 생략 가능, 생략 시 dir 전체 베이스라인 적용)' },
  });

  add('migration-revert', '.mig 의 down ops 를 working store 에 적용(역연산 — id 생략 시 마지막 파일)', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.readText || !fs!.list) return { ok: false, error: 'fs 권한 필요' };
    try {
      let id: string | null;
      if (typeof p.id === 'string') {
        id = await resolveMigId(fs!, p.dir, p.id);
        if (!id) return { ok: false, error: `migration not found: '${p.id}'` };
      } else {
        const files = extractMigNames(await fs!.list(p.dir));
        if (files.length === 0) return { ok: true, noop: true };
        id = files[files.length - 1]; // 마지막(최신) 파일
      }
      const { text } = await fs!.readText(joinPath(p.dir, id));
      const { downOps } = parseMig(text);
      let schema = snapshotSchema(store);
      for (const op of downOps) schema = applyOperation(schema, op);
      loadParsedSchema(store, schema, 'replace');
      return { ok: true, reverted: downOps.length, id };
    } catch (e) {
      return { ok: false, error: `migration-revert 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: '마이그레이션 디렉토리(절대경로)' },
    id: { type: 'string', description: '.mig 파일명(확장자 생략 가능, 생략 시 가장 최신 파일)' },
  });

  add('migration-lint', '.mig 텍스트 문법 검증(에러 목록, fs 불요)', (p) => {
    if (typeof p.text !== 'string') return { ok: false, error: 'text required' };
    const { errors } = lintMig(p.text);
    return { ok: true, errors, valid: errors.length === 0 };
  }, {
    text: { type: 'string', required: true, description: '검증할 .mig 텍스트' },
  });
}
