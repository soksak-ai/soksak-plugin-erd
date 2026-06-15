import type { ERDSchema, Table, Column, Relationship } from '@/types/schema';
import { generateId } from '@/lib/id';
import { sqlToPrisma, prismaToSql } from './type-map';
import { registerConverter, type Converter, type ParseResult } from './registry';

// ── Prisma generate ─────────────────────────────────────────────────────
// FK 방향 규약: source = 참조(PK) 측, target = FK 보유 측.
// Prisma 에서 @relation(fields/references) 는 FK 보유 측(=target)에 둔다.

export function generatePrisma(schema: ERDSchema): string {
  const tables = Object.values(schema.tables);
  if (tables.length === 0) return '// 정의된 테이블이 없습니다';

  // 테이블별로 "이 테이블이 FK 를 보유하는(=target) 관계" 목록을 모은다.
  const relsByTarget = new Map<string, Relationship[]>();
  for (const rel of Object.values(schema.relationships)) {
    const arr = relsByTarget.get(rel.targetTableId) ?? [];
    arr.push(rel);
    relsByTarget.set(rel.targetTableId, arr);
  }
  // 역방향(참조당하는 측 = source)에서 노출할 관계 필드도 모은다.
  const relsBySource = new Map<string, Relationship[]>();
  for (const rel of Object.values(schema.relationships)) {
    const arr = relsBySource.get(rel.sourceTableId) ?? [];
    arr.push(rel);
    relsBySource.set(rel.sourceTableId, arr);
  }

  const blocks: string[] = [];

  for (const table of tables) {
    const lines: string[] = [`model ${table.name} {`];

    for (const col of table.columns) {
      lines.push('  ' + generateFieldLine(col));
    }

    // FK 보유 측(=target): 관계 필드 + @relation 추가
    for (const rel of relsByTarget.get(table.id) ?? []) {
      const refTable = schema.tables[rel.sourceTableId];
      if (!refTable) continue;
      const fkCols = rel.targetColumnIds
        .map((id) => table.columns.find((c) => c.id === id)?.name)
        .filter((n): n is string => !!n);
      const refCols = rel.sourceColumnIds
        .map((id) => refTable.columns.find((c) => c.id === id)?.name)
        .filter((n): n is string => !!n);
      if (fkCols.length === 0 || refCols.length === 0) continue;
      const fieldName = lowerFirst(refTable.name);
      lines.push(
        `  ${fieldName} ${refTable.name} @relation(fields: [${fkCols.join(', ')}], references: [${refCols.join(', ')}])`,
      );
    }

    // 참조당하는 측(=source): 역참조 리스트 필드(타입[]) 추가
    for (const rel of relsBySource.get(table.id) ?? []) {
      const fkTable = schema.tables[rel.targetTableId];
      if (!fkTable) continue;
      const fieldName = lowerFirst(fkTable.name) + 's';
      lines.push(`  ${fieldName} ${fkTable.name}[]`);
    }

    lines.push('}');
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n\n') + '\n';
}

function generateFieldLine(col: Column): string {
  const { type } = sqlToPrisma(col.dataType);
  // nullable 은 타입 뒤 ? 로 표기
  let line = `${col.name} ${type}${col.nullable && !col.isPrimaryKey ? '?' : ''}`;
  const attrs: string[] = [];
  if (col.isPrimaryKey) attrs.push('@id');
  if (col.isUnique && !col.isPrimaryKey) attrs.push('@unique');
  if (col.autoIncrement) attrs.push('@default(autoincrement())');
  else if (col.defaultValue !== undefined && col.defaultValue !== '') {
    attrs.push(`@default(${formatDefault(col.defaultValue, type)})`);
  }
  if (attrs.length > 0) line += ' ' + attrs.join(' ');
  return line;
}

function formatDefault(value: string, prismaType: string): string {
  // 숫자/불리언 계열은 그대로, 문자열은 따옴표
  if (prismaType === 'Int' || prismaType === 'BigInt' || prismaType === 'Float' || prismaType === 'Decimal') {
    return value;
  }
  if (prismaType === 'Boolean') return value.toLowerCase();
  if (/^".*"$/.test(value)) return value;
  return `"${value}"`;
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

// ── Prisma parse ────────────────────────────────────────────────────────
// model 블록·필드·@relation 의 포커스드 파서.

export function parsePrisma(input: string): ParseResult {
  const schema: ERDSchema = { tables: {}, relationships: {}, layers: {} };
  const warnings: string[] = [];

  // 주석 제거(// 라인)
  const cleaned = input.replace(/\/\/[^\n]*/g, '');

  // model 블록 추출
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;

  // 관계 후처리용: { fkTableName, fkCols, refTableName, refCols }
  interface PendingRel {
    fkTableName: string;
    fkCols: string[];
    refTableName: string;
    refCols: string[];
  }
  const pendingRels: PendingRel[] = [];
  // 모델명 → tableId
  const tableIdByName = new Map<string, string>();

  while ((m = modelRegex.exec(cleaned)) !== null) {
    const modelName = m[1];
    const body = m[2];
    const tableId = generateId();
    const table: Table = { id: tableId, name: modelName, columns: [], indexes: [] };
    tableIdByName.set(modelName, tableId);

    const fieldLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('@@'));

    for (const line of fieldLines) {
      // 관계 필드(@relation) — FK 보유 측 표식
      const relMatch = line.match(/@relation\(\s*fields:\s*\[([^\]]+)\],\s*references:\s*\[([^\]]+)\]/);
      if (relMatch) {
        const fieldHead = line.match(/^(\w+)\s+(\w+)/);
        const refTableName = fieldHead ? fieldHead[2] : '';
        pendingRels.push({
          fkTableName: modelName,
          fkCols: splitList(relMatch[1]),
          refTableName,
          refCols: splitList(relMatch[2]),
        });
        continue;
      }

      // 필드 헤더: "name Type[?]" — 타입에 [](리스트=역참조)면 스칼라 아님 → 건너뜀
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fieldMatch) continue;
      const fieldName = fieldMatch[1];
      const prismaType = fieldMatch[2];
      const isList = !!fieldMatch[3];
      const optional = !!fieldMatch[4];
      const attrs = fieldMatch[5];

      // 리스트 타입(Foo[]) 또는 모델 타입 관계 필드는 스칼라 컬럼이 아니다.
      if (isList) continue;
      // 다른 모델을 가리키는 관계 필드(스칼라 매핑에 없는 PascalCase 타입)는 건너뜀
      if (/^[A-Z]/.test(prismaType) && !isKnownPrismaScalar(prismaType)) {
        continue;
      }

      const { type: sqlType, warning } = prismaToSql(prismaType);
      if (warning) warnings.push(warning);

      const col: Column = {
        id: generateId(),
        name: fieldName,
        dataType: sqlType,
        nullable: optional,
        autoIncrement: /@default\(\s*autoincrement\(\)\s*\)/.test(attrs),
        isPrimaryKey: /@id\b/.test(attrs),
        isUnique: /@unique\b/.test(attrs),
      };
      const defMatch = attrs.match(/@default\(\s*([^)]*)\)/);
      if (defMatch && !/autoincrement/.test(defMatch[1])) {
        col.defaultValue = defMatch[1].trim().replace(/^"|"$/g, '');
      }
      table.columns.push(col);
    }

    schema.tables[tableId] = table;
  }

  // 관계 후처리: FK 방향 규약 — source=참조(PK)측, target=FK 보유측
  for (const pr of pendingRels) {
    const fkTableId = tableIdByName.get(pr.fkTableName);
    const refTableId = tableIdByName.get(pr.refTableName);
    if (!fkTableId || !refTableId) {
      warnings.push(`관계 해석 실패: ${pr.fkTableName} → ${pr.refTableName}`);
      continue;
    }
    const fkTable = schema.tables[fkTableId];
    const refTable = schema.tables[refTableId];
    const targetColumnIds = pr.fkCols
      .map((n) => fkTable.columns.find((c) => c.name === n)?.id)
      .filter((id): id is string => !!id);
    const sourceColumnIds = pr.refCols
      .map((n) => refTable.columns.find((c) => c.name === n)?.id)
      .filter((id): id is string => !!id);

    const relId = generateId();
    const rel: Relationship = {
      id: relId,
      sourceTableId: refTableId, // 참조(PK) 측
      targetTableId: fkTableId, // FK 보유 측
      type: '1:N',
      sourceColumnIds,
      targetColumnIds,
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    };
    schema.relationships[relId] = rel;
  }

  return { schema, warnings };
}

// Prisma 내장 스칼라 집합 — 이 타입이면 실제 컬럼, 그 외 PascalCase 는 관계 필드.
const PRISMA_SCALARS = new Set(['Int', 'BigInt', 'String', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'Float']);
function isKnownPrismaScalar(t: string): boolean {
  return PRISMA_SCALARS.has(t);
}

function splitList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

// ── Converter 등록 ───────────────────────────────────────────────────────
export const prismaConverter: Converter = {
  id: 'prisma',
  direction: 'both',
  parse: parsePrisma,
  generate: generatePrisma,
};

// 모듈 로드 시 자기 등록(단일 진실 레지스트리에 배선).
registerConverter(prismaConverter);
