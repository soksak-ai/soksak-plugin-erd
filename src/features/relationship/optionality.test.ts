import { describe, it, expect } from 'vitest';
import { isRelationshipOptional, columnsById } from './optionality';

const tables = {
  users: { columns: [{ id: 'u_id', nullable: false }] },
  posts: {
    columns: [
      { id: 'p_id', nullable: false },
      { id: 'p_user_id', nullable: true }, // nullable FK → optional
      { id: 'p_author_id', nullable: false }, // NOT NULL FK → mandatory
    ],
  },
};

describe('isRelationshipOptional', () => {
  const cols = columnsById(tables);

  it('optional when the FK column (target/many side) is nullable', () => {
    expect(isRelationshipOptional({ type: '1:N', targetColumnIds: ['p_user_id'], sourceColumnIds: ['u_id'] }, cols)).toBe(true);
  });
  it('mandatory when the FK column is NOT NULL', () => {
    expect(isRelationshipOptional({ type: '1:N', targetColumnIds: ['p_author_id'], sourceColumnIds: ['u_id'] }, cols)).toBe(false);
  });
  it('mandatory when any FK column of a composite key is NOT NULL', () => {
    expect(isRelationshipOptional({ type: '1:N', targetColumnIds: ['p_user_id', 'p_author_id'] }, cols)).toBe(false);
  });
  it('N:M (junction) is never optional', () => {
    expect(isRelationshipOptional({ type: 'N:M', targetColumnIds: ['p_user_id'] }, cols)).toBe(false);
  });
  it('no FK columns → not optional', () => {
    expect(isRelationshipOptional({ type: '1:N', targetColumnIds: [] }, cols)).toBe(false);
    expect(isRelationshipOptional({ type: '1:N' }, cols)).toBe(false);
  });
  it('unknown FK column id → not optional (missing data is mandatory, not optional)', () => {
    expect(isRelationshipOptional({ type: '1:N', targetColumnIds: ['ghost'] }, cols)).toBe(false);
  });
});

describe('columnsById', () => {
  it('flattens every table column into an id lookup', () => {
    const m = columnsById(tables);
    expect(m.get('p_user_id')?.nullable).toBe(true);
    expect(m.get('u_id')?.nullable).toBe(false);
    expect(m.get('missing')).toBeUndefined();
  });
});
