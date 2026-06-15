import { AppLayout } from '@/components/layout/AppLayout';
import { ERDCanvas } from '@/components/canvas/ERDCanvas';
import { CreateTableDialog } from '@/components/dialogs/CreateTableDialog';
import { ImportSQLDialog } from '@/components/dialogs/ImportSQLDialog';
import { ImportMermaidDialog } from '@/components/dialogs/ImportMermaidDialog';
import { ImportMWBDialog } from '@/components/dialogs/ImportMWBDialog';
import { useThemeEffect } from '@/hooks/useTheme';
import '@/lib/perf';
import '@/lib/benchmark';

function App() {
  useThemeEffect();

  return (
    <>
      <AppLayout canvas={<ERDCanvas />} />
      <CreateTableDialog />
      <ImportSQLDialog />
      <ImportMermaidDialog />
      <ImportMWBDialog />
    </>
  );
}

export default App;
