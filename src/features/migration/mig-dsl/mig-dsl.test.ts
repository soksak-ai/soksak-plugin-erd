import { describe, it, expect } from 'vitest';
import type { Operation } from '../types';
import { parseMig, serializeMig, lintMig } from './index';
import { tokenize, TokenType } from './tokenizer';

// ────────────────────────────────────────────────────────────────────────
// 헬퍼: 파싱 결과 ops 를 type/params 비교용으로 정규화(id/timestamp 제거)
// ────────────────────────────────────────────────────────────────────────
function shape(ops: Operation[]): Array<{ type: string; params: Record<string, unknown> }> {
  return ops.map((o) => ({ type: o.type, params: o.params as Record<string, unknown> }));
}

// 정본 Operation 빌더(테스트 fixture 용). id/timestamp 는 parse 시 채워지므로 비교에서 무시.
function op(type: Operation['type'], params: Record<string, unknown>): Operation {
  return { id: 'x', type, timestamp: 0, params };
}

// ════════════════════════════════════════════════════════════════════════
// 토크나이저
// ════════════════════════════════════════════════════════════════════════
describe('tokenizer', () => {
  it('키워드·식별자·구두점·line:col 을 추적한다', () => {
    const toks = tokenize('up {\n  create table users;\n}');
    // EOF 제외하고 종류만 본다
    const kinds = toks.filter((t) => t.type !== TokenType.EOF && t.type !== TokenType.NL).map((t) => t.type);
    expect(kinds[0]).toBe(TokenType.Keyword); // up
    expect(kinds).toContain(TokenType.LBrace);
    expect(kinds).toContain(TokenType.RBrace);

    // 'create' 토큰의 위치: 2번째 줄 3번째 칸(1-based)
    const create = toks.find((t) => t.value === 'create');
    expect(create).toBeDefined();
    expect(create!.line).toBe(2);
    expect(create!.col).toBe(3);
  });

  it('-- 주석과 문자열 리터럴을 분리한다', () => {
    const toks = tokenize("-- hello\ncreate table t ( c varchar default 'a b' );");
    const comment = toks.find((t) => t.type === TokenType.Comment);
    expect(comment?.value).toContain('hello');
    const str = toks.find((t) => t.type === TokenType.String);
    expect(str?.value).toBe('a b');
  });

  it('-> 화살표를 단일 토큰으로 인식한다', () => {
    const toks = tokenize('posts ( user_id ) -> users ( id )');
    expect(toks.some((t) => t.type === TokenType.Arrow)).toBe(true);
  });

  it('정수 리터럴을 인식한다', () => {
    const toks = tokenize('default 0');
    const num = toks.find((t) => t.type === TokenType.Number);
    expect(num?.value).toBe('0');
  });
});

// ════════════════════════════════════════════════════════════════════════
// 파서 — 문법 fixture
// ════════════════════════════════════════════════════════════════════════
describe('parseMig: create table', () => {
  it('컬럼 정의(타입·pk·auto_increment·not null·default·unique)를 파싱한다', () => {
    const text = `up {
  create table users (
    id integer primary key auto_increment not null;
    email varchar not null unique;
    age integer default 0;
  );
}`;
    const { ops } = parseMig(text);
    expect(ops).toHaveLength(1);
    const ct = ops[0];
    expect(ct.type).toBe('createTable');
    const params = ct.params as Record<string, unknown>;
    expect(params.name).toBe('users');
    const cols = params.columns as Array<Record<string, unknown>>;
    expect(cols).toHaveLength(3);
    expect(cols[0]).toMatchObject({
      name: 'id',
      dataType: 'integer',
      isPrimaryKey: true,
      autoIncrement: true,
      nullable: false,
    });
    expect(cols[1]).toMatchObject({ name: 'email', dataType: 'varchar', nullable: false, isUnique: true });
    expect(cols[2]).toMatchObject({ name: 'age', dataType: 'integer', defaultValue: '0' });
  });

  it('스키마 한정 이름(qname)을 파싱한다', () => {
    const { ops } = parseMig('up {\n  create table app.users ( id integer );\n}');
    const p = ops[0].params as Record<string, unknown>;
    expect(p.name).toBe('users');
    expect(p.schema).toBe('app');
  });
});

describe('parseMig: alter table', () => {
  it('add column 을 addColumn 으로 파싱한다', () => {
    const { ops } = parseMig('up {\n  alter table users add column nick varchar not null default \'anon\';\n}');
    expect(shape(ops)).toEqual(
      shape([
        op('addColumn', {
          table: 'users',
          name: 'nick',
          dataType: 'varchar',
          nullable: false,
          defaultValue: "'anon'",
        }),
      ]),
    );
  });

  it('drop column 을 dropColumn 으로 파싱한다', () => {
    const { ops } = parseMig('up {\n  alter table users drop column nick;\n}');
    expect(shape(ops)).toEqual(shape([op('dropColumn', { table: 'users', name: 'nick' })]));
  });

  it('rename column 을 renameColumn 으로 파싱한다(to)', () => {
    const { ops } = parseMig('up {\n  alter table users rename column nick to nickname;\n}');
    expect(shape(ops)).toEqual(
      shape([op('renameColumn', { table: 'users', oldName: 'nick', newName: 'nickname' })]),
    );
  });

  it('alter column 은 새 전체 정의로 modifyColumnType 을 만든다(diff 기호 금지)', () => {
    const { ops } = parseMig('up {\n  alter table users alter column age bigint;\n}');
    expect(shape(ops)).toEqual(shape([op('modifyColumnType', { table: 'users', column: 'age', newType: 'bigint' })]));
  });
});

describe('parseMig: drop/rename table', () => {
  it('drop table', () => {
    const { ops } = parseMig('up {\n  drop table users;\n}');
    expect(shape(ops)).toEqual(shape([op('dropTable', { name: 'users' })]));
  });
  it('rename table (to)', () => {
    const { ops } = parseMig('up {\n  rename table users to members;\n}');
    expect(shape(ops)).toEqual(shape([op('renameTable', { oldName: 'users', newName: 'members' })]));
  });
});

describe('parseMig: fk / index', () => {
  it('add fk 를 addForeignKey 로 파싱한다(on delete/update)', () => {
    const text = `up {
  add fk fk_posts_user on posts ( user_id ) -> users ( id ) on delete cascade on update restrict;
}`;
    const { ops } = parseMig(text);
    expect(shape(ops)).toEqual(
      shape([
        op('addForeignKey', {
          name: 'fk_posts_user',
          table: 'posts',
          columns: ['user_id'],
          refTable: 'users',
          refColumns: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        }),
      ]),
    );
  });

  it('drop fk', () => {
    const { ops } = parseMig('up {\n  drop fk fk_posts_user on posts;\n}');
    expect(shape(ops)).toEqual(shape([op('dropForeignKey', { table: 'posts', name: 'fk_posts_user' })]));
  });

  it('create unique index', () => {
    const { ops } = parseMig('up {\n  create unique index idx_email on users ( email );\n}');
    expect(shape(ops)).toEqual(
      shape([op('createIndex', { table: 'users', name: 'idx_email', columns: ['email'], unique: true })]),
    );
  });

  it('create index (non-unique, 복합 컬럼)', () => {
    const { ops } = parseMig('up {\n  create index idx_ab on t ( a , b );\n}');
    expect(shape(ops)).toEqual(
      shape([op('createIndex', { table: 't', name: 'idx_ab', columns: ['a', 'b'], unique: false })]),
    );
  });

  it('drop index', () => {
    const { ops } = parseMig('up {\n  drop index idx_email on users;\n}');
    expect(shape(ops)).toEqual(shape([op('dropIndex', { table: 'users', name: 'idx_email' })]));
  });
});

describe('parseMig: raw', () => {
  it('raw 블록을 문자열 그대로 보존한다', () => {
    const { ops } = parseMig("up {\n  raw 'VACUUM ANALYZE;';\n}");
    expect(ops[0].type).toBe('raw');
    expect((ops[0].params as Record<string, unknown>).sql).toBe('VACUUM ANALYZE;');
  });
});

describe('parseMig: up/down + meta', () => {
  it('down 블록을 무시하지 않고 up 만 ops 로 반환한다(현재 scope: up)', () => {
    const text = `-- 011_add_users
up {
  create table users ( id integer );
}
down {
  drop table users;
}`;
    const { ops } = parseMig(text);
    // up 의 1개 작업만 정본 ops 로 본다
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('createTable');
  });
});

// ════════════════════════════════════════════════════════════════════════
// 직렬화 — 결정적 정규형
// ════════════════════════════════════════════════════════════════════════
describe('serializeMig', () => {
  it('결정적 정규형(고정 들여쓰기·문장 순서)을 낸다', () => {
    const ops: Operation[] = [
      op('createTable', {
        name: 'users',
        columns: [
          { name: 'id', dataType: 'integer', isPrimaryKey: true, autoIncrement: true, nullable: false },
          { name: 'email', dataType: 'varchar', nullable: false, isUnique: true },
        ],
      }),
    ];
    const out = serializeMig(ops);
    // 같은 입력 → 같은 출력(결정성)
    expect(serializeMig(ops)).toBe(out);
    // up 블록 + create table 정규형
    expect(out).toContain('up {');
    expect(out).toContain('create table users (');
    expect(out).toContain('id integer primary key auto_increment not null;');
    expect(out).toContain('email varchar not null unique;');
  });

  it('down 미기재 시 inverse.ts 로 자동 파생해 down 블록을 채운다', () => {
    const ops: Operation[] = [op('createTable', { name: 'users', columns: [{ name: 'id', dataType: 'integer' }] })];
    const out = serializeMig(ops);
    expect(out).toContain('down {');
    // createTable 의 역연산 = drop table users
    expect(out).toContain('drop table users;');
  });
});

// ════════════════════════════════════════════════════════════════════════
// 라운드트립: Operation[] → serialize → parse → 동치
// ════════════════════════════════════════════════════════════════════════
describe('round-trip', () => {
  const cases: Array<{ name: string; ops: Operation[] }> = [
    {
      name: 'create table (full column flags)',
      ops: [
        op('createTable', {
          name: 'users',
          columns: [
            { name: 'id', dataType: 'integer', isPrimaryKey: true, autoIncrement: true, nullable: false },
            { name: 'email', dataType: 'varchar', nullable: false, isUnique: true },
            { name: 'age', dataType: 'integer', nullable: true, defaultValue: '0' },
          ],
        }),
      ],
    },
    {
      name: 'create table with schema',
      ops: [op('createTable', { name: 'users', schema: 'app', columns: [{ name: 'id', dataType: 'integer', nullable: true }] })],
    },
    { name: 'addColumn', ops: [op('addColumn', { table: 'users', name: 'nick', dataType: 'varchar', nullable: false })] },
    { name: 'dropColumn', ops: [op('dropColumn', { table: 'users', name: 'nick' })] },
    { name: 'renameColumn', ops: [op('renameColumn', { table: 'users', oldName: 'a', newName: 'b' })] },
    { name: 'modifyColumnType', ops: [op('modifyColumnType', { table: 'users', column: 'age', newType: 'bigint' })] },
    { name: 'dropTable', ops: [op('dropTable', { name: 'users' })] },
    { name: 'renameTable', ops: [op('renameTable', { oldName: 'a', newName: 'b' })] },
    {
      name: 'addForeignKey',
      ops: [
        op('addForeignKey', {
          name: 'fk_posts_user',
          table: 'posts',
          columns: ['user_id'],
          refTable: 'users',
          refColumns: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      ],
    },
    { name: 'dropForeignKey', ops: [op('dropForeignKey', { table: 'posts', name: 'fk_posts_user' })] },
    { name: 'createIndex unique', ops: [op('createIndex', { table: 'users', name: 'idx_email', columns: ['email'], unique: true })] },
    { name: 'createIndex multi', ops: [op('createIndex', { table: 't', name: 'idx_ab', columns: ['a', 'b'], unique: false })] },
    { name: 'dropIndex', ops: [op('dropIndex', { table: 'users', name: 'idx_email' })] },
  ];

  for (const c of cases) {
    it(`${c.name} 라운드트립이 동치다`, () => {
      const text = serializeMig(c.ops);
      const { ops: parsed } = parseMig(text);
      // up 블록만 비교(down 은 자동파생이므로 제외)
      expect(shape(parsed)).toEqual(shape(c.ops));
    });
  }

  it('이중 라운드트립(parse∘serialize)이 안정(fixpoint)하다', () => {
    const ops: Operation[] = [
      op('createTable', {
        name: 'users',
        columns: [{ name: 'id', dataType: 'integer', isPrimaryKey: true, nullable: false }],
      }),
      op('addColumn', { table: 'users', name: 'email', dataType: 'varchar', nullable: true }),
    ];
    const text1 = serializeMig(ops);
    const reparsed = parseMig(text1).ops;
    const text2 = serializeMig(reparsed);
    expect(text2).toBe(text1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 에러 케이스: 잘못된 DSL → line:col 명확
// ════════════════════════════════════════════════════════════════════════
describe('error reporting (line:col)', () => {
  it('알 수 없는 키워드는 line:col 과 함께 throw 한다', () => {
    let err: unknown;
    try {
      parseMig('up {\n  frobnicate table users;\n}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { line?: number; col?: number }).line).toBe(2);
    expect((err as Error & { line?: number; col?: number }).col).toBe(3);
  });

  it('닫는 괄호 누락은 에러를 던진다', () => {
    expect(() => parseMig('up {\n  create table users ( id integer ;\n}')).toThrow();
  });

  it('세미콜론 누락은 에러를 던진다', () => {
    expect(() => parseMig('up {\n  drop table users\n}')).toThrow();
  });

  it('lintMig 는 throw 대신 {errors:[{line,col,message}]} 로 보고한다', () => {
    const { errors } = lintMig('up {\n  frobnicate table users;\n}');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatchObject({ line: 2, col: 3 });
    expect(typeof errors[0].message).toBe('string');
  });

  it('lintMig 는 정상 입력에 빈 errors 를 반환한다', () => {
    const { errors } = lintMig('up {\n  drop table users;\n}');
    expect(errors).toEqual([]);
  });
});
