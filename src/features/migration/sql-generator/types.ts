import type { Operation } from '../types';
import type { SQLDialect } from '@/types/schema';

export interface SQLGenerator {
  dialect: SQLDialect;
  generate(op: Operation): string;
  generateBatch(ops: Operation[]): string;
}
