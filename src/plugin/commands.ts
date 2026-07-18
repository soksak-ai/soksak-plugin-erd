// 헤드리스 커맨드 카탈로그 — store mutation 의 얇은 래퍼.
// 모든 핸들러는 이름 기반 주소지정 + 멱등(ifNotExists/ifExists/noop) + {ok,code,message} 규약을 따른다.
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

// 다음 단계 제안 1건. cmd 는 완전정규화 커맨드 주소(plugin.<id>.<name>), why 는 제안 어조 한국어 문장.
type Hint = { cmd: string; why: string };

// soksak ctx 의 최소 표면(커맨드 등록 + 구독 폐기 수집 + 선택적 fs).
interface PluginContext {
  subscriptions: Array<{ dispose(): void }>;
  app: {
    commands?: {
      register(
        name: string,
        spec: {
          description: string;
          triggers?: { ko?: string; [lang: string]: string | undefined };
          message?: (data: any) => string;
          params?: Record<string, unknown>;
          // 코어 커맨드 스펙과 동형 — 성공 결과(data)로부터 다음 단계 커맨드를 최대 3개까지 제안.
          hint?: (data: any, ctx?: any) => Hint[];
          handler: (params: any) => Promise<any>;
        },
      ): { dispose(): void };
    };
    fs?: PluginFs;
  };
}

type Ok = { ok: true; [k: string]: unknown };
type Err = { ok: false; code: string; message: string; [k: string]: unknown };
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

  // 완전정규화 커맨드 주소(외부 sok/MCP/소켓 호출 규약) — hint.cmd 조립용.
  const cmd = (name: string) => `plugin.soksak-plugin-erd.${name}`;

  // 등록 + 구독 수집 + internal 적재를 한 번에.
  // message 는 성공 결과(data)를 한 문장으로 요약 — 코어 메시지 프로토콜(command.message) 표면.
  // hint 는 대표 사용 사이클이 있는 커맨드에만 선택 부여(다음 단계 제안, 상한 3).
  const add = (
    name: string,
    description: string,
    triggers: { ko: string },
    message: (data: any) => string,
    handler: (params: any) => CmdResult | Promise<CmdResult>,
    params?: Record<string, unknown>,
    hint?: (data: any) => Hint[],
  ) => {
    const wrapped = async (p: any): Promise<CmdResult> => handler(p ?? {});
    internal.set(name, wrapped);
    ctx.subscriptions.push(register(name, { description, triggers, message, params, hint, handler: wrapped }));
  };

  // ── Introspection ──────────────────────────────────────────────────────────
  add('get-schema', 'Return current ERD schema (mode: compact summary | full raw)', { ko: '스키마 조회 ERD 전체 구조 확인' }, () => '스키마를 조회했습니다', (p) => {
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
    mode: { type: 'string', enum: ['compact', 'full'], description: 'Output format: compact summary or full raw schema', default: 'compact' },
  });

  add('list-tables', 'List all tables (id, name, column count)', { ko: '테이블 목록 조회 테이블 이름' }, (d) => `테이블 ${(d.tables ?? []).length}개`, () => {
    const tables = Object.values(store.getState().tables).map((t) => ({
      id: t.id,
      name: t.name,
      columnCount: t.columns.length,
    }));
    return { ok: true, tables };
  });

  add('get-table', 'Retrieve a single table by name or id', { ko: '테이블 조회 단건' }, (d) => `테이블 '${d.table?.name}' 을 조회했습니다`, (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, table: r.table };
  }, {
    table: { type: 'string', required: true, description: 'Table name or id' },
  });

  add('get-columns', 'List all columns of a table', { ko: '컬럼 목록 조회' }, (d) => `컬럼 ${(d.columns ?? []).length}개`, (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    return { ok: true, columns: r.table.columns };
  }, {
    table: { type: 'string', required: true, description: 'Table name or id' },
  });

  add('list-relationships', 'List all FK relationships in the schema', { ko: '관계 목록 조회 외래키 FK' }, (d) => `관계 ${(d.relationships ?? []).length}개`, () => {
    const relationships = Object.values(store.getState().relationships);
    return { ok: true, relationships };
  });

  add('validate', 'Validate schema integrity and return an array of issues', { ko: '스키마 검증 무결성 이슈 확인' }, (d) => `이슈 ${(d.issues ?? []).length}개`, () => {
    const issues = validateSchema(snapshotSchema(store));
    return { ok: true, issues };
  }, undefined, (d) => (d.issues ?? []).length > 0 ? [] : [
    { cmd: cmd('export-sql'), why: '검증된 스키마로 SQL 을 생성할 수 있습니다' },
    { cmd: cmd('migration-generate'), why: '변경사항을 마이그레이션으로 기록할 수 있습니다' },
  ]);

  add('stats', 'Return schema statistics: table count, column count, relationship count', { ko: '스키마 통계 테이블 컬럼 관계 수' }, (d) => `테이블 ${d.stats?.tableCount ?? 0}개 · 컬럼 ${d.stats?.columnCount ?? 0}개`, () => {
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

  add('diff', 'Compare a baseline schema (from) against the current schema and report added/removed tables', { ko: '스키마 비교 변경 테이블 추가 삭제' }, (d) => `추가 ${(d.diff?.addedTables ?? []).length}개 · 삭제 ${(d.diff?.removedTables ?? []).length}개`, (p) => {
    const from = p.from as ERDSchema | undefined;
    if (!from || typeof from !== 'object' || !from.tables) {
      return { ok: false, code: 'INVALID_INPUT', message: 'diff requires { from: ERDSchema }' };
    }
    const fromNames = new Set(Object.values(from.tables).map((t) => t.name));
    const nowNames = new Set(Object.values(store.getState().tables).map((t) => t.name));
    const addedTables = [...nowNames].filter((n) => !fromNames.has(n));
    const removedTables = [...fromNames].filter((n) => !nowNames.has(n));
    return { ok: true, diff: { addedTables, removedTables } };
  }, {
    from: { type: 'json', required: true, description: 'Baseline schema to compare against (ERDSchema: { tables, relationships, layers })' },
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  add('create-table', 'Create a table; idempotent when ifNotExists is true', { ko: '테이블 생성 추가 만들기' }, (d) => d.noop ? '이미 존재해 그대로 둡니다' : '테이블을 생성했습니다', (p) => {
    if (!p.name || typeof p.name !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'name required' };
    const existing = Object.values(store.getState().tables).find(
      (t) => t.name.toLowerCase() === p.name.toLowerCase(),
    );
    if (existing) {
      if (p.ifNotExists) return { ok: true, id: existing.id, noop: true };
      return { ok: false, code: 'ALREADY_EXISTS', message: `table already exists: '${p.name}'` };
    }
    const id = store.getState().addTable({
      name: p.name,
      columns: p.columns,
      comment: p.comment,
      schema: p.schema,
    });
    return { ok: true, id };
  }, {
    name: { type: 'string', required: true, description: 'Name of the table to create' },
    columns: { type: 'json', description: 'Initial column definitions (partial Column[] array)' },
    comment: { type: 'string', description: 'Table comment' },
    schema: { type: 'string', description: 'Schema namespace the table belongs to' },
    ifNotExists: { type: 'boolean', description: 'Return noop instead of error when a table with the same name already exists' },
  }, (d) => d.noop ? [] : [
    { cmd: cmd('add-column'), why: '컬럼을 추가할 수 있습니다' },
    { cmd: cmd('add-relationship'), why: '다른 테이블과 관계를 연결할 수 있습니다' },
  ]);

  add('rename-table', 'Rename an existing table', { ko: '테이블 이름 변경 rename' }, () => '테이블 이름을 변경했습니다', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'name required' };
    store.getState().updateTable(r.id, { name: p.name });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    name: { type: 'string', required: true, description: 'New table name' },
  });

  add('drop-table', 'Delete a table; idempotent when ifExists is true', { ko: '테이블 삭제 제거 drop' }, (d) => d.noop ? '이미 없어 그대로 둡니다' : '테이블을 삭제했습니다', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) {
      if (p.ifExists) return { ok: true, noop: true };
      return r;
    }
    store.getState().removeTable(r.id);
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: 'Table name or id to delete' },
    ifExists: { type: 'boolean', description: 'Return noop instead of error when the table does not exist' },
  });

  add('add-column', 'Add a column to a table; idempotent when ifNotExists is true', { ko: '컬럼 추가 열 추가' }, (d) => d.noop ? '컬럼이 이미 있어 그대로 둡니다' : '컬럼을 추가했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!p.name || typeof p.name !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'name required' };
    const exists = r.table.columns.find((c) => c.name.toLowerCase() === p.name.toLowerCase());
    if (exists) {
      if (p.ifNotExists) return { ok: true, columnId: exists.id, noop: true };
      return { ok: false, code: 'ALREADY_EXISTS', message: `column already exists: '${p.name}'` };
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
    table: { type: 'string', required: true, description: 'Target table name or id' },
    name: { type: 'string', required: true, description: 'Column name to add' },
    dataType: { type: 'string', description: 'Data type (e.g. INT, VARCHAR)' },
    nullable: { type: 'boolean', description: 'Whether the column allows NULL' },
    isPrimaryKey: { type: 'boolean', description: 'Whether this column is a primary key' },
    isUnique: { type: 'boolean', description: 'Whether this column has a UNIQUE constraint' },
    autoIncrement: { type: 'boolean', description: 'Whether this column auto-increments' },
    defaultValue: { type: 'string', description: 'Default value expression' },
    comment: { type: 'string', description: 'Column comment' },
    length: { type: 'number', description: 'Column length (e.g. n in VARCHAR(n))' },
    ifNotExists: { type: 'boolean', description: 'Return noop instead of error when a column with the same name already exists' },
  });

  add('update-column', 'Update properties of an existing column', { ko: '컬럼 수정 속성 변경' }, () => '컬럼을 수정했습니다', (p) => {
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
    table: { type: 'string', required: true, description: 'Target table name or id' },
    column: { type: 'string', required: true, description: 'Target column name or id' },
    name: { type: 'string', description: 'New column name' },
    dataType: { type: 'string', description: 'New data type' },
    nullable: { type: 'boolean', description: 'Whether the column allows NULL' },
    isPrimaryKey: { type: 'boolean', description: 'Whether this column is a primary key' },
    isUnique: { type: 'boolean', description: 'Whether this column has a UNIQUE constraint' },
    autoIncrement: { type: 'boolean', description: 'Whether this column auto-increments' },
    defaultValue: { type: 'string', description: 'Default value expression' },
    comment: { type: 'string', description: 'Column comment' },
    length: { type: 'number', description: 'Column length' },
    precision: { type: 'number', description: 'Numeric precision' },
    scale: { type: 'number', description: 'Numeric scale (decimal places)' },
  });

  add('drop-column', 'Delete a column; idempotent when ifExists is true', { ko: '컬럼 삭제 제거' }, (d) => d.noop ? '컬럼이 이미 없어 그대로 둡니다' : '컬럼을 삭제했습니다', (p) => {
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
    table: { type: 'string', required: true, description: 'Target table name or id' },
    column: { type: 'string', required: true, description: 'Column name or id to delete' },
    ifExists: { type: 'boolean', description: 'Return noop instead of error when the column does not exist' },
  });

  add('reorder-columns', 'Reorder columns of a table by providing column names/ids in the desired order', { ko: '컬럼 순서 변경 재배열' }, () => '컬럼 순서를 변경했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns)) return { ok: false, code: 'INVALID_INPUT', message: 'columns array required' };
    const ids: string[] = [];
    for (const arg of p.columns) {
      const cr = resolveColumn(r.table, arg);
      if (!cr.ok) return cr;
      ids.push(cr.id);
    }
    store.getState().reorderColumns(r.id, ids);
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    columns: { type: 'json', required: true, description: 'Column names or ids in the desired order' },
  });

  add('set-pk', 'Set or clear the primary key flag on a column', { ko: '기본키 설정 PK 지정 해제' }, () => '기본키를 설정했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === undefined ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, value ? { isPrimaryKey: true, nullable: false } : { isPrimaryKey: false });
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    column: { type: 'string', required: true, description: 'Target column name or id' },
    value: { type: 'boolean', description: 'true to set PK (default), false to clear' },
  });

  add('set-unique', 'Set or clear the UNIQUE constraint on a column', { ko: '유니크 설정 UNIQUE 제약 지정 해제' }, () => 'UNIQUE 를 설정했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const cr = resolveColumn(r.table, p.column);
    if (!cr.ok) return cr;
    const value = p.value === undefined ? true : !!p.value;
    store.getState().updateColumn(r.id, cr.id, { isUnique: value });
    return { ok: true };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    column: { type: 'string', required: true, description: 'Target column name or id' },
    value: { type: 'boolean', description: 'true to set UNIQUE (default), false to clear' },
  });

  add('add-index', 'Add an index to a table; idempotent when ifNotExists is true', { ko: '인덱스 추가 색인 생성' }, (d) => d.noop ? '인덱스가 이미 있어 그대로 둡니다' : '인덱스를 추가했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    if (!Array.isArray(p.columns) || p.columns.length === 0) {
      return { ok: false, code: 'INVALID_INPUT', message: 'columns array required' };
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
    table: { type: 'string', required: true, description: 'Target table name or id' },
    columns: { type: 'json', required: true, description: 'Column names or ids that compose the index' },
    name: { type: 'string', description: 'Index name (auto-generated when omitted)' },
    unique: { type: 'boolean', description: 'Whether this is a UNIQUE index' },
    type: { type: 'string', description: 'Index type (e.g. BTREE, HASH)' },
    ifNotExists: { type: 'boolean', description: 'Return noop instead of error when an index with the same name already exists' },
  });

  add('drop-index', 'Delete an index by name or id; idempotent when ifExists is true', { ko: '인덱스 삭제 색인 제거' }, (d) => d.noop ? '인덱스가 이미 없어 그대로 둡니다' : '인덱스를 삭제했습니다', (p) => {
    const r = getTable(store, p.table);
    if (!r.ok) return r;
    const idx = r.table.indexes.find((i) => i.name === p.index || i.id === p.index);
    if (!idx) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, code: 'NOT_FOUND', message: `index not found: '${p.index}'` };
    }
    store.getState().updateTable(r.id, {
      indexes: r.table.indexes.filter((i) => i.id !== idx.id),
    });
    return { ok: true, indexId: idx.id };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    index: { type: 'string', required: true, description: 'Index name or id to delete' },
    ifExists: { type: 'boolean', description: 'Return noop instead of error when the index does not exist' },
  });

  add('add-relationship', 'Add a FK relationship (source=referenced PK side, target=FK holder; autoFk generates the FK column automatically)', { ko: '관계 추가 외래키 FK 테이블 연결' }, () => '관계를 추가했습니다', (p) => {
    const sr = getTable(store, p.source);
    if (!sr.ok) return sr;
    const tr = getTable(store, p.target);
    if (!tr.ok) return tr;
    const type: RelationType = (p.type as RelationType) ?? '1:N';

    // source 의 PK 컬럼(참조 대상). 없으면 첫 컬럼 폴백.
    const srcPk = sr.table.columns.find((c) => c.isPrimaryKey) ?? sr.table.columns[0];
    if (!srcPk) return { ok: false, code: 'NO_TARGET', message: `source table '${sr.table.name}' has no columns to reference` };

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
    source: { type: 'string', required: true, description: 'Referenced (PK-holding) table name or id' },
    target: { type: 'string', required: true, description: 'FK-holding table name or id' },
    type: { type: 'string', enum: ['1:1', '1:N', 'N:M'], description: 'Relationship cardinality', default: '1:N' },
    targetColumns: { type: 'json', description: 'Explicit FK column names/ids on the target table (takes priority over autoFk)' },
    autoFk: { type: 'boolean', description: 'Auto-create a <source>_<pk> FK column on the target table when no targetColumns are given' },
    name: { type: 'string', description: 'Relationship (constraint) name' },
    onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON DELETE referential action', default: 'NO ACTION' },
    onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON UPDATE referential action', default: 'NO ACTION' },
  }, () => [
    { cmd: cmd('auto-layout'), why: '테이블 배치를 자동 정렬할 수 있습니다' },
    { cmd: cmd('validate'), why: '스키마 무결성을 검증할 수 있습니다' },
  ]);

  add('update-relationship', 'Update properties of an existing FK relationship', { ko: '관계 수정 외래키 속성 변경' }, () => '관계를 수정했습니다', (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      return { ok: false, code: 'NOT_FOUND', message: `relationship not found: '${p.id}'` };
    }
    const updates: Partial<Relationship> = {};
    for (const k of ['name', 'type', 'onDelete', 'onUpdate', 'lineStyle'] as const) {
      if (p[k] !== undefined) (updates as any)[k] = p[k];
    }
    store.getState().updateRelationship(p.id, updates);
    return { ok: true, id: p.id };
  }, {
    id: { type: 'string', required: true, description: 'Relationship id to update' },
    name: { type: 'string', description: 'Relationship name' },
    type: { type: 'string', enum: ['1:1', '1:N', 'N:M'], description: 'Relationship cardinality' },
    onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON DELETE referential action' },
    onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'], description: 'ON UPDATE referential action' },
    lineStyle: { type: 'string', enum: ['dashed', 'solid'], description: 'Visual line style for the relationship edge' },
  });

  add('drop-relationship', 'Delete a FK relationship; idempotent when ifExists is true', { ko: '관계 삭제 외래키 제거' }, (d) => d.noop ? '관계가 이미 없어 그대로 둡니다' : '관계를 삭제했습니다', (p) => {
    if (!p.id || !store.getState().relationships[p.id]) {
      if (p.ifExists) return { ok: true, noop: true };
      return { ok: false, code: 'NOT_FOUND', message: `relationship not found: '${p.id}'` };
    }
    store.getState().removeRelationship(p.id);
    return { ok: true, id: p.id };
  }, {
    id: { type: 'string', required: true, description: 'Relationship id to delete' },
    ifExists: { type: 'boolean', description: 'Return noop instead of error when the relationship does not exist' },
  });

  add('set-color', 'Set or clear the highlight color of a table', { ko: '테이블 색상 설정 하이라이트 해제' }, () => '색상을 설정했습니다', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    store.getState().updateTable(r.id, { color: p.color ?? undefined });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    color: { type: 'string', description: 'Color value (e.g. #RRGGBB). Omit or pass null to clear' },
  });

  // ── Batch ─────────────────────────────────────────────────────────────────
  // apply: ops 를 순차 실행. atomic(기본 true)이면 시작 시점 스냅샷을 떠두고 실패 시 전체 복원.
  add('apply', 'Execute a batch of commands sequentially; rolls back to a snapshot on failure when atomic is true', { ko: '배치 실행 여러 명령 순차 원자적 롤백' }, (d) => `${(d.results ?? []).length}개 명령을 실행했습니다`, async (p) => {
    const ops = p.ops as Array<{ command: string; params?: any }> | undefined;
    if (!Array.isArray(ops)) return { ok: false, code: 'INVALID_INPUT', message: 'ops array required' };
    const atomic = p.atomic !== false;

    const before = atomic ? deepSnapshot(store) : null;

    const results: CmdResult[] = [];
    let failedAt = -1;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const h = internal.get(op.command);
      let res: CmdResult;
      if (!h) {
        res = { ok: false, code: 'UNKNOWN_COMMAND', message: `unknown command in batch: '${op.command}'` };
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
        code: 'BATCH_FAILED',
        message: `batch failed at op ${failedAt}: ${(results[failedAt] as Err).message}`,
        failedAt,
        rolledBack: true,
        results,
      };
    }
    if (anyFailed) {
      return { ok: false, code: 'BATCH_FAILED', message: 'batch completed with failures', failedAt, results };
    }
    // 성공 시 마이그레이션 버전으로 커밋(슬라이스 표면이 있을 때만).
    if (p.title && typeof store.getState().commitVersion === 'function') {
      try { store.getState().commitVersion(p.title); } catch { /* 헤드리스 안전 무시 */ }
    }
    return { ok: true, results };
  }, {
    ops: { type: 'json', required: true, description: 'Array of operations to execute ([{ command, params }])' },
    atomic: { type: 'boolean', description: 'Roll back all changes to the pre-batch snapshot if any operation fails (default true)', default: true },
    title: { type: 'string', description: 'Migration version title to commit on success' },
  }, (d) => d.ok === false ? [] : [
    { cmd: cmd('get-schema'), why: '적용된 스키마를 확인할 수 있습니다' },
    { cmd: cmd('validate'), why: '무결성을 검증할 수 있습니다' },
  ]);

  add('undo', 'Revert the last uncommitted operation using the migration slice', { ko: '실행 취소 되돌리기 undo' }, () => '실행을 취소했습니다', () => {
    const fn = store.getState().undoLastOperation;
    if (typeof fn !== 'function') return { ok: false, code: 'UNAVAILABLE', message: 'undo not available' };
    const inverse = fn();
    return { ok: true, inverse };
  });

  // redo 는 마이그레이션 슬라이스에 아직 표면이 없다 → stub(P3/P4 통합).
  // TODO(P3/P4): migration-slice 에 redo 표면 추가 후 배선. 현재는 noop.
  add('redo', 'Re-apply the last undone operation (stub; wiring deferred to P3/P4)', { ko: '다시 실행 redo 복원' }, () => '다시 실행했습니다', () => {
    return { ok: true, noop: true, todo: 'redo wiring deferred to P3/P4' };
  });

  // ── Layout ────────────────────────────────────────────────────────────────
  add('auto-layout', 'Compute and apply automatic table positions using the dagre graph layout algorithm', { ko: '자동 배치 레이아웃 dagre 위치 정렬' }, (d) => `${d.count ?? 0}개 테이블을 배치했습니다`, (p) => {
    const schema = snapshotSchema(store);
    const positions = computeAutoLayout(schema, store.getState().nodePositions, {
      direction: p.direction ?? 'TB',
    });
    store.getState().setNodePositions(positions);
    return { ok: true, count: Object.keys(positions).length };
  }, {
    direction: { type: 'string', enum: ['TB', 'LR', 'BT', 'RL'], description: 'Layout direction (dagre rankdir)', default: 'TB' },
  });

  add('set-position', 'Set the canvas position of a table by name or id', { ko: '테이블 위치 설정 좌표 이동' }, () => '위치를 설정했습니다', (p) => {
    const r = resolveTable(store, p.table);
    if (!r.ok) return r;
    if (typeof p.x !== 'number' || typeof p.y !== 'number') {
      return { ok: false, code: 'INVALID_INPUT', message: 'x and y numbers required' };
    }
    store.getState().setNodePosition(r.id, { x: p.x, y: p.y });
    return { ok: true, id: r.id };
  }, {
    table: { type: 'string', required: true, description: 'Target table name or id' },
    x: { type: 'number', required: true, description: 'Canvas x coordinate' },
    y: { type: 'number', required: true, description: 'Canvas y coordinate' },
  });

  add('get-viewport', 'Return the current canvas viewport (x, y, zoom)', { ko: '뷰포트 조회 캔버스 좌표 줌' }, () => '뷰포트를 조회했습니다', () => {
    return { ok: true, viewport: store.getState().viewport };
  });

  add('set-viewport', 'Set canvas viewport position and zoom; omitted fields keep their current value', { ko: '뷰포트 설정 캔버스 이동 줌' }, () => '뷰포트를 설정했습니다', (p) => {
    const v = store.getState().viewport;
    store.getState().setViewport({
      x: typeof p.x === 'number' ? p.x : v.x,
      y: typeof p.y === 'number' ? p.y : v.y,
      zoom: typeof p.zoom === 'number' ? p.zoom : v.zoom,
    });
    return { ok: true, viewport: store.getState().viewport };
  }, {
    x: { type: 'number', description: 'Viewport x offset (keeps current value when omitted)' },
    y: { type: 'number', description: 'Viewport y offset (keeps current value when omitted)' },
    zoom: { type: 'number', description: 'Zoom scale factor (keeps current value when omitted)' },
  });

  add('select', 'Select table nodes on the canvas by name or id array', { ko: '테이블 선택 노드 선택' }, (d) => `테이블 ${(d.selected ?? []).length}개를 선택했습니다`, (p) => {
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
    tables: { type: 'json', description: 'Table names or ids to select' },
  });

  add('fit', 'Fit the viewport to all content on the canvas (no-op in headless mode when the view is not mounted)', { ko: '뷰포트 맞춤 전체 보기 fit' }, (d) => d.applied ? '뷰포트를 맞췄습니다' : '뷰가 열려 있지 않습니다', () => {
    // 뷰(PixiERDCanvas)가 마운트 시 store 에 등록하는 doFitView 를 호출한다. 미마운트면 null →
    // applied:false(정상 — 헤드리스 동작이라 좌표/뷰포트는 그대로). 뷰 열림 후 호출하면 테이블이 보인다.
    const fit = store.getState().fitViewFn;
    if (!fit) return { ok: true, applied: false, reason: 'view not mounted' };
    fit();
    return { ok: true, applied: true, viewport: store.getState().viewport };
  });

  add('get-render-state', 'Return render and view state for E2E assertions (mounted, node counts, viewport)', { ko: '렌더 상태 조회 뷰 E2E 단언' }, (d) => `테이블 ${d.tableCount ?? 0}개 · 관계 ${d.relationshipCount ?? 0}개`, () => {
    const s = store.getState();
    return {
      ok: true,
      mounted: s.fitViewFn != null, // 뷰의 Pixi 캔버스가 fit 함수를 등록 = 마운트됨
      tableCount: Object.keys(s.tables).length,
      relationshipCount: Object.keys(s.relationships).length,
      positionedCount: Object.keys(s.nodePositions).length,
      collapsedCount: Object.values(s.collapsedNodes).filter(Boolean).length,
      selectedCount: s.selectedNodeIds.length,
      // 캔버스가 실제로 만든 렌더러 수(store 수치와 다르면 첫 페인트 회귀) — 미마운트면 null.
      rendererCount: s.renderStatsFn?.().rendererCount ?? null,
      viewport: s.viewport,
    };
  });

  // ── import / export(멀티-DB Dialect + 포맷 변환기 배선) ──────────────────────
  // export: 현재 스키마 → 외부 포맷 문자열. import: 외부 포맷 → 파싱 후 store 적재.
  // 파싱 실패/엔진 throw 는 {ok:false,code,message} 로 흡수한다.

  // import-* 4종(sql/dbml/prisma/mermaid) 공통 다음 단계 — 가져온 스키마 검증 + 배치.
  const importHint = (d: any): Hint[] => d.ok === false ? [] : [
    { cmd: cmd('validate'), why: '가져온 스키마의 무결성을 검증할 수 있습니다' },
    { cmd: cmd('auto-layout'), why: '테이블 배치를 자동 정렬할 수 있습니다' },
  ];

  add('export-sql', 'Generate SQL DDL from the current schema for the selected dialect', { ko: 'SQL 내보내기 DDL 생성 데이터베이스' }, () => 'SQL 을 생성했습니다', (p) => {
    const dialect = (p.dialect as DialectId) ?? 'mysql';
    try {
      const sql = getDialect(dialect).generate(snapshotSchema(store));
      return { ok: true, sql };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `export-sql failed: ${(e as Error).message}` };
    }
  }, {
    dialect: { type: 'string', enum: ['sqlite', 'mysql', 'postgresql'], description: 'Target database dialect', default: 'mysql' },
  });

  add('import-sql', 'Parse SQL DDL text and load it into the schema', { ko: 'SQL 가져오기 DDL 파싱 불러오기' }, (d) => `테이블 ${d.added?.tables ?? 0}개를 가져왔습니다`, (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'text required' };
    const dialect = (p.dialect as DialectId) ?? 'mysql';
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = getDialect(dialect).parse(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `import-sql failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: 'SQL DDL text to parse' },
    dialect: { type: 'string', enum: ['sqlite', 'mysql', 'postgresql'], description: 'Dialect of the input DDL', default: 'mysql' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge: add on top of existing schema; replace: clear then load', default: 'merge' },
  }, importHint);

  add('export-dbml', 'Generate DBML from the current schema', { ko: 'DBML 내보내기 생성' }, () => 'DBML 을 생성했습니다', () => {
    try {
      return { ok: true, dbml: generateDbml(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `export-dbml failed: ${(e as Error).message}` };
    }
  });

  add('import-dbml', 'Parse DBML text and load it into the schema', { ko: 'DBML 가져오기 파싱 불러오기' }, (d) => `테이블 ${d.added?.tables ?? 0}개를 가져왔습니다`, (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = parseDbml(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `import-dbml failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: 'DBML text to parse' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge: add on top of existing schema; replace: clear then load', default: 'merge' },
  }, importHint);

  add('export-prisma', 'Generate a Prisma schema from the current ERD schema', { ko: 'Prisma 스키마 내보내기 생성' }, () => 'Prisma 스키마를 생성했습니다', () => {
    try {
      return { ok: true, prisma: generatePrisma(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `export-prisma failed: ${(e as Error).message}` };
    }
  });

  add('import-prisma', 'Parse a Prisma schema text and load it into the ERD schema', { ko: 'Prisma 스키마 가져오기 파싱 불러오기' }, (d) => `테이블 ${d.added?.tables ?? 0}개를 가져왔습니다`, (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      const { schema, warnings } = parsePrisma(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `import-prisma failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: 'Prisma schema text to parse' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge: add on top of existing schema; replace: clear then load', default: 'merge' },
  }, importHint);

  add('export-mermaid', 'Generate a Mermaid erDiagram from the current schema', { ko: 'Mermaid 다이어그램 내보내기 생성' }, () => 'Mermaid 다이어그램을 생성했습니다', () => {
    try {
      return { ok: true, mermaid: generateMermaid(snapshotSchema(store)) };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `export-mermaid failed: ${(e as Error).message}` };
    }
  });

  add('import-mermaid', 'Parse a Mermaid erDiagram text and load it into the schema', { ko: 'Mermaid 다이어그램 가져오기 파싱 불러오기' }, (d) => `테이블 ${d.added?.tables ?? 0}개를 가져왔습니다`, (p) => {
    if (!p.text || typeof p.text !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'text required' };
    const mode: 'merge' | 'replace' = p.mode === 'replace' ? 'replace' : 'merge';
    try {
      // parseMermaid 는 ERDSchema 를 직접 반환(다른 파서와 달리 warnings 래퍼 없음) → warnings=[].
      const schema = parseMermaid(p.text);
      const added = loadParsedSchema(store, schema, mode);
      return { ok: true, added, warnings: [] };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `import-mermaid failed: ${(e as Error).message}` };
    }
  }, {
    text: { type: 'string', required: true, description: 'Mermaid erDiagram text to parse' },
    mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge: add on top of existing schema; replace: clear then load', default: 'merge' },
  }, importHint);

  // ── migration(파일 기반 .mig 마이그레이션) ───────────────────────────────────
  // write 계열은 dir(절대경로) 필수 — 헤드리스·명시적(프로젝트 git 관리).
  // fs 는 ctx.app.fs 가 있을 때만(권한 게이트). 없으면 {ok:false,code:'GATE_REQUIRED',message:"fs 권한 필요"}.
  const fs = ctx.app.fs;

  // fs 게이트 — read/write 필요한 커맨드의 공통 가드.
  const needFs = (): Err | null => (fs ? null : { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' });
  const requireDir = (p: any): Err | null =>
    typeof p.dir === 'string' && p.dir.length > 0 ? null : { ok: false, code: 'INVALID_INPUT', message: 'dir(절대경로) required' };

  add('migration-status', 'Preview pending changes by diffing the baseline (.mig files) against the current working schema', { ko: '마이그레이션 상태 대기 변경 미리보기' }, (d) => d.clean ? '대기 중인 변경이 없습니다' : `대기 변경 ${d.pendingOps ?? 0}개`, async (p) => {
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
      return { ok: false, code: 'INTERNAL', message: `migration-status 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
  }, (d) => (d.pendingOps ?? 0) > 0 ? [
    { cmd: cmd('migration-generate'), why: '대기 변경을 .mig 파일로 생성할 수 있습니다' },
  ] : []);

  add('migration-generate', 'Generate a .mig file from the diff between the baseline and the current schema; previews only unless confirm is true', { ko: '마이그레이션 생성 .mig 파일 diff 저장' }, (d) => d.noop ? '변경이 없습니다' : d.written ? `${d.filename} 을 기록했습니다` : '미리보기를 생성했습니다', async (p) => {
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
      if (!fs!.writeText) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
      const filename = migFilename(files.length);
      const path = joinPath(p.dir, filename);
      await fs!.writeText(path, mig);
      return { ok: true, written: true, filename, path, ops };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `migration-generate 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
    name: { type: 'string', description: 'Migration name written as a -- name: comment in the file' },
    confirm: { type: 'boolean', description: 'Write the file to disk when true; return a preview (mig/ops) only when omitted' },
  }, (d) => d.written ? [
    { cmd: cmd('migration-sql'), why: '생성된 마이그레이션의 SQL 을 확인할 수 있습니다' },
    { cmd: cmd('migration-apply'), why: '마이그레이션을 워킹 스키마에 적용할 수 있습니다' },
  ] : []);

  add('migration-list', 'List .mig files in a directory sorted by name (chronological order)', { ko: '마이그레이션 목록 .mig 파일 조회' }, (d) => `마이그레이션 ${d.count ?? 0}개`, async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.list) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
    try {
      const listing = await fs!.list(p.dir);
      const files = extractMigNames(listing);
      return { ok: true, files, count: files.length };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `migration-list 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
  });

  add('migration-show', 'Show the raw text and parsed content of a single .mig file', { ko: '마이그레이션 조회 .mig 내용 파싱 결과' }, (d) => `마이그레이션 '${d.id}' 을 조회했습니다`, async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!p.id || typeof p.id !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'id(파일명) required' };
    if (!fs!.readText) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
    try {
      const file = await resolveMigId(fs!, p.dir, p.id);
      if (!file) return { ok: false, code: 'NOT_FOUND', message: `migration not found: '${p.id}'` };
      const { text } = await fs!.readText(joinPath(p.dir, file));
      const { ops, downOps, warnings } = parseMig(text);
      return { ok: true, id: file, name: parseMigName(text), text, ops, downOps, warnings };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `migration-show 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
    id: { type: 'string', required: true, description: '.mig filename (extension is optional)' },
  });

  add('migration-sql', 'Convert the up operations of a single .mig file into dialect-specific DDL statements', { ko: '마이그레이션 SQL 변환 DDL 생성 dialect' }, () => 'SQL 을 생성했습니다', async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!p.id || typeof p.id !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'id(파일명) required' };
    if (!fs!.readText) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
    const dialect = (p.dialect as 'mysql' | 'postgresql') ?? 'mysql';
    if (dialect !== 'mysql' && dialect !== 'postgresql') {
      return { ok: false, code: 'INVALID_INPUT', message: `migration-sql dialect 미지원: '${dialect}'(mysql|postgresql)` };
    }
    try {
      const file = await resolveMigId(fs!, p.dir, p.id);
      if (!file) return { ok: false, code: 'NOT_FOUND', message: `migration not found: '${p.id}'` };
      const { text } = await fs!.readText(joinPath(p.dir, file));
      const { ops, downOps } = parseMig(text);
      // mig op[] → DDL: migration sql-generator 가 Operation[] 을 직접 받는다(generateAlter 의
      // SchemaDiff 시그니처와 형태 불일치 → ops 직접 generate 채택).
      const gen = getSQLGenerator(dialect);
      return { ok: true, id: file, dialect, up: gen.generateBatch(ops), down: gen.generateBatch(downOps) };
    } catch (e) {
      return { ok: false, code: 'INTERNAL', message: `migration-sql 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
    id: { type: 'string', required: true, description: '.mig filename (extension is optional)' },
    dialect: { type: 'string', enum: ['mysql', 'postgresql'], description: 'Target database dialect', default: 'mysql' },
  });

  add('migration-apply', 'Apply the up operations of a .mig file (or all files when id is omitted) to the working schema', { ko: '마이그레이션 적용 up 스키마 반영' }, (d) => `${d.applied ?? 0}개 연산을 적용했습니다`, async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.readText || !fs!.list) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
    try {
      let ops: Operation[];
      if (p.id && typeof p.id === 'string') {
        const file = await resolveMigId(fs!, p.dir, p.id);
        if (!file) return { ok: false, code: 'NOT_FOUND', message: `migration not found: '${p.id}'` };
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
      return { ok: false, code: 'INTERNAL', message: `migration-apply 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
    id: { type: 'string', description: '.mig filename (extension optional); omit to fold all files in the directory' },
  });

  add('migration-revert', 'Apply the down operations of a .mig file to the working schema (defaults to the most recent file)', { ko: '마이그레이션 되돌리기 down 롤백 역연산' }, (d) => d.noop ? '되돌릴 마이그레이션이 없습니다' : `${d.reverted ?? 0}개 연산을 되돌렸습니다`, async (p) => {
    const g = needFs(); if (g) return g;
    const d = requireDir(p); if (d) return d;
    if (!fs!.readText || !fs!.list) return { ok: false, code: 'GATE_REQUIRED', message: 'fs 권한 필요' };
    try {
      let id: string | null;
      if (typeof p.id === 'string') {
        id = await resolveMigId(fs!, p.dir, p.id);
        if (!id) return { ok: false, code: 'NOT_FOUND', message: `migration not found: '${p.id}'` };
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
      return { ok: false, code: 'INTERNAL', message: `migration-revert 실패: ${errMsg(e)}` };
    }
  }, {
    dir: { type: 'string', required: true, description: 'Absolute path to the migration directory' },
    id: { type: 'string', description: '.mig filename (extension optional); omit to revert the most recent file' },
  });

  add('migration-lint', 'Validate .mig text syntax and return a list of errors (no fs access required)', { ko: '마이그레이션 문법 검사 lint .mig 오류' }, (d) => d.valid ? '문법 오류가 없습니다' : `오류 ${(d.errors ?? []).length}개`, (p) => {
    if (typeof p.text !== 'string') return { ok: false, code: 'INVALID_INPUT', message: 'text required' };
    const { errors } = lintMig(p.text);
    return { ok: true, errors, valid: errors.length === 0 };
  }, {
    text: { type: 'string', required: true, description: '.mig text to validate' },
  });
}
