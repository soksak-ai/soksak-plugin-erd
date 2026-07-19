import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { setAutoFreeze } from 'immer';
import { createSchemaSlice, type SchemaSlice } from './slices/schema-slice';
import { createDiagramSlice, type DiagramSlice } from './slices/diagram-slice';
import { createUISlice, type UISlice } from './slices/ui-slice';

export type StoreState = SchemaSlice & DiagramSlice & UISlice;

// Large ERD states (hundreds of tables/relations) suffer severe interaction latency
// when Immer deep-freezes every update in dev. Disable auto-freeze for responsiveness.
setAutoFreeze(false);

// devtools removed — serializing 1,122 tables on every state change is a perf killer
// Use ?devtools query param + React DevTools Zustand extension if needed
export const useStore = create<StoreState>()(
  immer((...a) => ({
    ...createSchemaSlice(...a),
    ...createDiagramSlice(...a),
    ...createUISlice(...a),
  }))
);
