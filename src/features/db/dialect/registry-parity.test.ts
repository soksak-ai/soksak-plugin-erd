import { describe, it, expect } from 'vitest';
import type { ERDSchema } from '@/types/schema';
import type { DialectId } from './types';
import { getDialect } from './registry';
import { generateDDL } from '@/features/sql/ddl-generator';
import { useStore } from '@/store';

// 선행정리-1: UI 의 DDL 소스를 레거시 generateDDL(2-dialect) 에서 dialect registry(3-dialect)로 수렴.
// db 기능이 dialect.caps 에 의존하므로 UI 표시 SQL 과 registry 가 같은 소스여야 드리프트=실 DB 오동작을 막는다.

const schema: ERDSchema = {
  tables: {
    t1: {
      id: 't1',
      name: 'users',
      columns: [
        { id: 'c1', name: 'id', dataType: 'INTEGER', nullable: false, autoIncrement: true, isPrimaryKey: true, isUnique: false },
        { id: 'c2', name: 'email', dataType: 'VARCHAR(255)', nullable: false, autoIncrement: false, isPrimaryKey: false, isUnique: true },
      ],
      indexes: [],
    },
  },
  relationships: {},
  layers: {},
};

describe('선행정리-1: UI DDL 소스 = dialect registry', () => {
  // generateDDL 헤더의 `-- Date:` 타임스탬프는 호출마다 달라 바이트 비교에서 제외(구조 동일성만 검증).
  const stripDate = (ddl: string) => ddl.replace(/-- Date: .*/g, '-- Date: <ts>');

  it('mysql/postgresql 는 레거시 generateDDL 과 바이트 동일 — UI 스왑은 무회귀', () => {
    for (const id of ['mysql', 'postgresql'] as const) {
      expect(stripDate(getDialect(id).generate(schema))).toBe(stripDate(generateDDL(schema, id)));
    }
  });

  it('sqlite 는 registry 로 도달 — INTEGER PRIMARY KEY AUTOINCREMENT, backtick 없음', () => {
    const ddl = getDialect('sqlite').generate(schema);
    expect(ddl).toContain('AUTOINCREMENT');
    expect(ddl).not.toContain('`'); // backtick 은 MySQL 전용 인용부호
  });

  it('스토어 dialect 축이 sqlite 를 수용 → UI 경로가 sqlite DDL 산출', () => {
    // 개명 전엔 setDialect 가 SQLDialect('mysql'|'postgresql')라 'sqlite' 대입이 타입 에러(RED).
    // DialectId 이행 후 통과(GREEN). UI(BottomPanel/FileMenu)가 쓰는 경로와 동일하게 검증.
    useStore.getState().setDialect('sqlite');
    const dialect: DialectId = useStore.getState().dialect;
    expect(dialect).toBe('sqlite');
    expect(getDialect(dialect).generate(schema)).toContain('AUTOINCREMENT');
  });
});
