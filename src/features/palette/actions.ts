// Command palette action registry — a projection of the app's operable actions
// into a searchable list. Each action either drives a store method, a canvas
// function, or the undo/redo history. Per-table "Jump to" actions make the
// palette a navigation surface too. cmdk does the fuzzy filtering; this builds
// the full candidate list from current state.
import { useStore } from '@/store';
import { undo, redo } from '@/store/history';
import { focusTable } from '@/features/navigation/focus-table';

export interface PaletteAction {
  id: string;
  label: string;
  group: 'Create' | 'Edit' | 'View' | 'Export' | 'Navigate';
  keywords?: string;
  run: () => void;
}

export function buildPaletteActions(): PaletteAction[] {
  const s = useStore.getState();
  const actions: PaletteAction[] = [
    // Create
    { id: 'new-table', label: 'New table…', group: 'Create', keywords: 'add create', run: () => s.setCreateTableDialogOpen(true) },
    { id: 'import-sql', label: 'Import SQL…', group: 'Create', keywords: 'ddl load', run: () => s.setImportSQLDialogOpen(true) },
    { id: 'import-mermaid', label: 'Import Mermaid…', group: 'Create', keywords: 'diagram load', run: () => s.setImportMermaidDialogOpen(true) },
    { id: 'import-mwb', label: 'Import MySQL Workbench (.mwb)…', group: 'Create', keywords: 'workbench load', run: () => s.setImportMWBDialogOpen(true) },
    // Edit
    { id: 'undo', label: 'Undo', group: 'Edit', keywords: 'revert back', run: () => undo() },
    { id: 'redo', label: 'Redo', group: 'Edit', keywords: 'forward again', run: () => redo() },
    { id: 'select-all', label: 'Select all tables', group: 'Edit', keywords: 'everything', run: () => s.setSelectedNodeIds(Object.keys(useStore.getState().tables)) },
    { id: 'clear-selection', label: 'Clear selection', group: 'Edit', keywords: 'deselect none', run: () => s.setSelectedNodeIds([]) },
    // View
    { id: 'auto-layout', label: 'Auto layout', group: 'View', keywords: 'arrange dagre organize', run: () => s.triggerAutoLayout() },
    { id: 'fit-view', label: 'Fit view', group: 'View', keywords: 'zoom all reset', run: () => s.fitViewFn?.() },
    { id: 'toggle-left', label: 'Toggle left sidebar', group: 'View', keywords: 'tables panel', run: () => s.toggleLeftSidebar() },
    { id: 'toggle-right', label: 'Toggle properties panel', group: 'View', keywords: 'right inspector', run: () => s.toggleRightSidebar() },
    { id: 'toggle-bottom', label: 'Toggle bottom panel', group: 'View', keywords: 'sql console', run: () => s.toggleBottomPanel() },
    { id: 'dialect-mysql', label: 'Dialect: MySQL', group: 'View', keywords: 'database engine', run: () => s.setDialect('mysql') },
    { id: 'dialect-postgresql', label: 'Dialect: PostgreSQL', group: 'View', keywords: 'database engine postgres', run: () => s.setDialect('postgresql') },
  ];

  // Navigate — one jump action per table (search-driven canvas navigation).
  for (const t of Object.values(s.tables)) {
    actions.push({
      id: `jump:${t.id}`,
      label: `Jump to ${t.name}`,
      group: 'Navigate',
      keywords: `goto table ${t.name}`,
      run: () => focusTable(t.id),
    });
  }
  return actions;
}
