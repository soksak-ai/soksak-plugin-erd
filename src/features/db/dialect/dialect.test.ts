import { describe, it, expect } from 'vitest';
import type { ERDSchema, Column } from '@/types/schema';
import { getDialect, dialectRegistry } from './registry';
import { deriveCanonical } from './canonical';
import type { DialectId } from './types';

// ── ID 정규화 ────────────────────────────────────────────────────────────
// parse 는 매번 새 nanoid 를 생성하므로 모델 deep-equal 비교에서 ID 는 제거한다.
// 이름 기반 안정 키로 치환해 "스키마 모델"의 동등성만 본다(문자열 DDL 비교 금지).

interface NormColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  autoIncrement: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: string;
  enumValues?: string[];
}

interface NormRelationship {
  // 이름 대신 테이블/컬럼 이름으로 환원 — FK 방향 불변식(source=참조PK, target=FK보유) 검증용
  sourceTable: string;
  targetTable: string;
  sourceColumns: string[];
  targetColumns: string[];
  type: string;
  onDelete: string;
  onUpdate: string;
}

interface NormSchema {
  tables: Array<{
    name: string;
    schema?: string;
    columns: NormColumn[];
  }>;
  relationships: NormRelationship[];
}

function colName(schema: ERDSchema, tableId: string, colId: string): string {
  const t = schema.tables[tableId];
  return t?.columns.find((c) => c.id === colId)?.name ?? '<?>';
}

function normalize(schema: ERDSchema): NormSchema {
  const tables = Object.values(schema.tables)
    .map((t) => ({
      name: t.name,
      schema: t.schema,
      columns: t.columns.map((c) => {
        const nc: NormColumn = {
          name: c.name,
          dataType: c.dataType.toUpperCase(),
          nullable: c.nullable,
          autoIncrement: c.autoIncrement,
          isPrimaryKey: c.isPrimaryKey,
          isUnique: c.isUnique,
        };
        if (c.defaultValue !== undefined) nc.defaultValue = c.defaultValue;
        if (c.enumValues !== undefined) nc.enumValues = c.enumValues;
        return nc;
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const relationships = Object.values(schema.relationships)
    .map((r) => ({
      sourceTable: schema.tables[r.sourceTableId]?.name ?? '<?>',
      targetTable: schema.tables[r.targetTableId]?.name ?? '<?>',
      sourceColumns: r.sourceColumnIds.map((id) => colName(schema, r.sourceTableId, id)),
      targetColumns: r.targetColumnIds.map((id) => colName(schema, r.targetTableId, id)),
      type: r.type,
      onDelete: r.onDelete,
      onUpdate: r.onUpdate,
    }))
    .sort((a, b) =>
      (a.targetTable + a.targetColumns.join()).localeCompare(b.targetTable + b.targetColumns.join()),
    );

  return { tables, relationships };
}

// ── 대표 DDL fixture (dialect 별) ────────────────────────────────────────
// 라운드트립: fixture → parse → generate → re-parse, 그리고 첫 parse 모델 == 재-parse 모델.

const MYSQL_DDL = `
CREATE TABLE \`users\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`email\` VARCHAR(255) NOT NULL UNIQUE,
  \`name\` VARCHAR(120) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE \`posts\` (
  \`id\` BIGINT NOT NULL AUTO_INCREMENT,
  \`user_id\` BIGINT NOT NULL,
  \`title\` VARCHAR(200) NOT NULL,
  PRIMARY KEY (\`id\`),
  CONSTRAINT \`fk_posts_users\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const POSTGRES_DDL = `
CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "posts" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_posts_users" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
`;

const SQLITE_DDL = `
CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL
);

CREATE TABLE "posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "fk_posts_users" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);
`;

const FIXTURES: Record<DialectId, string> = {
  mysql: MYSQL_DDL,
  postgresql: POSTGRES_DDL,
  sqlite: SQLITE_DDL,
};

describe('dialect registry', () => {
  it('세 dialect 가 모두 등록되어 있다', () => {
    expect(Object.keys(dialectRegistry).sort()).toEqual(['mysql', 'postgresql', 'sqlite']);
    for (const id of ['mysql', 'postgresql', 'sqlite'] as DialectId[]) {
      expect(getDialect(id).id).toBe(id);
    }
  });

  it('알 수 없는 dialect 는 throw', () => {
    expect(() => getDialect('oracle' as DialectId)).toThrow();
  });
});

describe.each(['mysql', 'postgresql', 'sqlite'] as DialectId[])('%s 라운드트립', (id) => {
  const dialect = getDialect(id);
  const ddl = FIXTURES[id];

  it('parse → generate → re-parse 가 동일한 스키마 모델을 만든다', () => {
    const first = dialect.parse(ddl);
    expect(first.schema.tables && Object.keys(first.schema.tables).length).toBe(2);

    const regen = dialect.generate(first.schema);
    const second = dialect.parse(regen);

    // 문자열이 아니라 모델 비교(deep-equal)
    expect(normalize(second.schema)).toEqual(normalize(first.schema));
  });

  it('FK 방향 불변식 보존: source=참조 PK(users), target=FK 보유(posts)', () => {
    const { schema } = dialect.parse(ddl);
    const rels = Object.values(schema.relationships);
    expect(rels).toHaveLength(1);
    const norm = normalize(schema).relationships[0];
    expect(norm.sourceTable).toBe('users');
    expect(norm.targetTable).toBe('posts');
    expect(norm.sourceColumns).toEqual(['id']);
    expect(norm.targetColumns).toEqual(['user_id']);
    expect(norm.onDelete).toBe('CASCADE');
  });

  it('auto-increment 컬럼이 보존된다(Column.autoIncrement 불변)', () => {
    const { schema } = dialect.parse(ddl);
    const users = Object.values(schema.tables).find((t) => t.name === 'users')!;
    const idCol = users.columns.find((c) => c.name === 'id')!;
    expect(idCol.autoIncrement).toBe(true);
    expect(idCol.isPrimaryKey).toBe(true);
  });
});

// ── 타입 매핑 표(일부) ────────────────────────────────────────────────────
// canonical → dialect native 매핑이 caps 에 맞게 실현되는지.

function col(partial: Partial<Column>): Column {
  return {
    id: 'x',
    name: partial.name ?? 'c',
    dataType: partial.dataType ?? 'TEXT',
    nullable: partial.nullable ?? true,
    autoIncrement: partial.autoIncrement ?? false,
    isPrimaryKey: partial.isPrimaryKey ?? false,
    isUnique: partial.isUnique ?? false,
    ...partial,
  };
}

describe('canonical 파생', () => {
  it('Column.dataType 문자열은 유지되고 canonical 은 lazy 파생된다', () => {
    const c = col({ dataType: 'VARCHAR(255)' });
    const canon = deriveCanonical(c);
    expect(c.dataType).toBe('VARCHAR(255)'); // 원본 불변
    expect(canon.base).toBe('VARCHAR');
    expect(canon.args).toEqual([255]);
  });

  it('DECIMAL(10,2) 의 args 를 파싱한다', () => {
    const canon = deriveCanonical(col({ dataType: 'DECIMAL(10, 2)' }));
    expect(canon.base).toBe('DECIMAL');
    expect(canon.args).toEqual([10, 2]);
  });
});

describe('타입 매핑 표', () => {
  // canonical base → 각 dialect native
  const cases: Array<{ canonical: string; mysql: string; postgresql: string; sqlite: string }> = [
    { canonical: 'INTEGER', mysql: 'INT', postgresql: 'INTEGER', sqlite: 'INTEGER' },
    { canonical: 'BIGINT', mysql: 'BIGINT', postgresql: 'BIGINT', sqlite: 'INTEGER' },
    { canonical: 'BOOLEAN', mysql: 'TINYINT(1)', postgresql: 'BOOLEAN', sqlite: 'INTEGER' },
    { canonical: 'TEXT', mysql: 'TEXT', postgresql: 'TEXT', sqlite: 'TEXT' },
    { canonical: 'DOUBLE', mysql: 'DOUBLE', postgresql: 'DOUBLE PRECISION', sqlite: 'REAL' },
  ];

  it.each(cases)('$canonical 매핑', ({ canonical, mysql, postgresql, sqlite }) => {
    const c = col({ dataType: canonical });
    expect(getDialect('mysql').mapType(deriveCanonical(c), c)).toBe(mysql);
    expect(getDialect('postgresql').mapType(deriveCanonical(c), c)).toBe(postgresql);
    expect(getDialect('sqlite').mapType(deriveCanonical(c), c)).toBe(sqlite);
  });
});

describe('DialectCaps', () => {
  it('sqlite 는 inlineForeignKeys=true, alterAddConstraint=false', () => {
    const caps = getDialect('sqlite').caps;
    expect(caps.inlineForeignKeys).toBe(true);
    expect(caps.alterAddConstraint).toBe(false);
    expect(caps.autoIncrement).toBe('autoincrement');
  });

  it('mysql autoIncrement=serial? 아니오 — autoincrement 키워드 계열', () => {
    expect(getDialect('mysql').caps.autoIncrement).toBe('autoincrement');
    expect(getDialect('postgresql').caps.autoIncrement).toBe('serial');
  });
});
