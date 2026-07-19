// Cardinality labels for numeric notation (the alternative to crow's foot). Each endpoint gets a
// short label: the "one" side is 1, or 0..1 when the relationship is optional (nullable FK); the
// "many" side is N (or M for the second side of N:M). Pure so it is unit tested without Pixi.
import type { RelationType } from '@/types/schema';

export interface CardinalityLabels {
  source: string;
  target: string;
}

export function cardinalityLabels(type: RelationType, optional: boolean): CardinalityLabels {
  const one = optional ? '0..1' : '1';
  switch (type) {
    case '1:1':
      // Both ends are "one"; optionality applies to the referenced (source) side.
      return { source: one, target: '1' };
    case 'N:M':
      // Junction — both ends are "many"; distinct letters read as a many-to-many.
      return { source: 'N', target: 'M' };
    case '1:N':
    default:
      return { source: one, target: 'N' };
  }
}
