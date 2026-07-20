import type { Operation } from '../types';
import type { DialectId } from '@/features/db/dialect/types';

export interface SQLGenerator {
  dialect: DialectId;
  generate(op: Operation): string;
  generateBatch(ops: Operation[]): string;
}
