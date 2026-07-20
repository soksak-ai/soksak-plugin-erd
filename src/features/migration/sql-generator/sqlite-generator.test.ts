import { describe, it, expect } from 'vitest';
import type { Operation, OperationType } from '../types';
import { SQLiteGenerator } from './sqlite-generator';
import { getSQLGenerator } from './index';

const op = (type: OperationType, params: Record<string, unknown>): Operation => ({
  id: 'op',
  type,
  timestamp: 0,
  params,
});

// 선행정리-2: 실행축(.mig→DDL)의 dialect 비대칭 해소 — export-sql 은 sqlite 포함 3-dialect 인데
// migration-sql 은 mysql|postgresql 만이었다. SQLiteGenerator 신설로 대칭 확보.
describe('선행정리-2: SQLiteGenerator', () => {
  const g = new SQLiteGenerator();

  it('createTable: 단일 autoInc PK 는 INTEGER PRIMARY KEY AUTOINCREMENT 인라인, " 인용', () => {
    const sql = g.generate(
      op('createTable', {
        name: 'users',
        columns: [
          { name: 'id', dataType: 'INTEGER', autoIncrement: true, isPrimaryKey: true, nullable: false },
          { name: 'email', dataType: 'VARCHAR', length: 255, nullable: false, isUnique: true },
        ],
      }),
    );
    expect(sql).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(sql).toContain('"users"');
    expect(sql).not.toContain('`'); // backtick 은 MySQL 전용
    expect(sql).not.toContain('AUTO_INCREMENT'); // MySQL 키워드
    expect(sql).not.toMatch(/PRIMARY KEY \("id"\)/); // 인라인이므로 별도 PK 절 금지
  });

  it('미지원 ALTER(타입변경/PK/FK)는 거짓 SQL 대신 재작성 경고(R4)', () => {
    for (const t of ['modifyColumnType', 'addPrimaryKey', 'addForeignKey'] as const) {
      expect(g.generate(op(t, { table: 'users' }))).toContain('테이블 재작성 필요');
    }
  });

  it('createIndex/dropIndex 는 SQLite 문법(DROP INDEX 에 테이블 절 없음)', () => {
    expect(
      g.generate(op('createIndex', { name: 'idx', table: 'users', columns: ['email'], unique: true })),
    ).toBe('CREATE UNIQUE INDEX "idx" ON "users"("email");');
    expect(g.generate(op('dropIndex', { name: 'idx', table: 'users' }))).toBe('DROP INDEX "idx";');
  });

  it('레지스트리가 sqlite 를 반환 — 실행축 3-dialect 대칭', () => {
    expect(getSQLGenerator('sqlite')).toBeInstanceOf(SQLiteGenerator);
    expect(getSQLGenerator('sqlite').dialect).toBe('sqlite');
  });
});
