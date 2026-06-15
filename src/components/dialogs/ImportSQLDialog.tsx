import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { perf } from '@/lib/perf';
import { computeLayoutCenter, computeSeedLayout } from '@/features/layout/seed-layout';
import type { ImportWorkerRequest, ImportWorkerResponse } from '@/workers/import.worker';
import { blobWorker } from '@/workers/inline-worker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';
import type { SQLDialect } from '@/types/schema';

function createImportWorker() {
  // 번들 플러그인(blob ESM): import.meta.url URL 워커 불가 → IIFE 문자열을 blob 워커로.
  return blobWorker(__ERD_WORKER_IMPORT__);
}

export function ImportSQLDialog() {
  const open = useStore((s) => s.importSQLDialogOpen);
  const setOpen = useStore((s) => s.setImportSQLDialogOpen);
  const loadSchema = useStore((s) => s.loadSchema);
  const clearSchema = useStore((s) => s.clearSchema);
  const setNodePositions = useStore((s) => s.setNodePositions);
  const dialect = useStore((s) => s.dialect);

  const [sqlText, setSqlText] = useState('');
  const [selectedDialect, setSelectedDialect] = useState<SQLDialect>(dialect);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ tableCount: number; relCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewWorkerRef = useRef<Worker | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced preview via worker
  useEffect(() => {
    if (!sqlText.trim()) {
      return;
    }

    // Debounce: wait 300ms after last keystroke
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      // Terminate previous preview worker if still running
      previewWorkerRef.current?.terminate();

      const worker = createImportWorker();
      previewWorkerRef.current = worker;

      worker.onmessage = (e: MessageEvent<ImportWorkerResponse>) => {
        if (e.data.type === 'parseResult') {
          const tableCount = Object.keys(e.data.schema.tables).length;
          const relCount = Object.keys(e.data.schema.relationships).length;
          setPreview({ tableCount, relCount });
          setError(null);
        } else if (e.data.type === 'error') {
          setPreview(null);
        }
        worker.terminate();
        if (previewWorkerRef.current === worker) {
          previewWorkerRef.current = null;
        }
      };

      worker.postMessage({
        type: 'parseSQL',
        payload: { sql: sqlText },
      } satisfies ImportWorkerRequest);
    }, 300);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [sqlText]);

  // Cleanup workers on unmount
  useEffect(() => {
    return () => {
      previewWorkerRef.current?.terminate();
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSqlText(reader.result as string);
      setError(null);
      setPreview(null);
    };
    reader.readAsText(file);
  }, []);

  const resetForm = useCallback(() => {
    setSqlText('');
    setError(null);
    setPreview(null);
    setMode('replace');
  }, []);

  const handleImport = useCallback(() => {
    if (importing) return;
    setImporting(true);
    setError(null);

    perf.start('import:parseSQL');
    const worker = createImportWorker();

    worker.onmessage = (e: MessageEvent<ImportWorkerResponse>) => {
      perf.end('import:parseSQL');

      if (e.data.type === 'error') {
        setError(e.data.message);
        setImporting(false);
        worker.terminate();
        return;
      }

      const { schema } = e.data;
      const tableCount = Object.keys(schema.tables).length;
      if (tableCount === 0) {
        setError('No CREATE TABLE statements found in the SQL.');
        setImporting(false);
        worker.terminate();
        return;
      }

      const store = useStore.getState();
      const existingPositions = store.nodePositions;
      let startX = 0;
      if (mode === 'merge') {
        let maxX = 0;
        for (const pos of Object.values(existingPositions)) {
          if (pos.x > maxX) maxX = pos.x;
        }
        startX = maxX + 380;
      } else {
        clearSchema();
      }

      const seedTables = Object.values(schema.tables).map((t) => ({
        id: t.id,
        name: t.name,
        columnCount: t.columns.length,
      }));
      const seedPositions = computeSeedLayout(seedTables, { startX, startY: 0 });
      setNodePositions(seedPositions);

      perf.start('import:loadSchema');
      loadSchema(schema.tables, schema.relationships);
      perf.end('import:loadSchema');

      store.setDialect(selectedDialect);
      if (mode === 'replace') {
        const center = computeLayoutCenter(seedPositions);
        if (center) {
          store.setViewport({ x: center.x, y: center.y, zoom: 1 });
        }
      }

      setOpen(false);
      resetForm();
      setImporting(false);
      worker.terminate();
    };

    worker.onerror = (err) => {
      perf.end('import:parseSQL');
      setError(err.message || 'Worker error during SQL parsing.');
      setImporting(false);
      worker.terminate();
    };

    worker.postMessage({
      type: 'parseSQL',
      payload: { sql: sqlText },
    } satisfies ImportWorkerRequest);
  }, [sqlText, mode, selectedDialect, clearSchema, loadSchema, setNodePositions, setOpen, importing, resetForm]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }, [setOpen, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import SQL</DialogTitle>
          <DialogDescription>Paste SQL DDL or upload a .sql file to import tables.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium">Dialect</label>
              <Select value={selectedDialect} onValueChange={(v) => setSelectedDialect(v as SQLDialect)}>
                <SelectTrigger size="sm" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Import Mode</label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'replace' | 'merge')}>
                <SelectTrigger size="sm" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">Replace All</SelectItem>
                  <SelectItem value="merge">Merge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">SQL</label>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3 mr-1" />
                Upload .sql
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
            <Textarea
              value={sqlText}
              onChange={(e) => { setSqlText(e.target.value); setError(null); setPreview(null); }}
              placeholder="CREATE TABLE users (&#10;  id INT PRIMARY KEY AUTO_INCREMENT,&#10;  name VARCHAR(255) NOT NULL&#10;);"
              className="font-mono text-xs min-h-40"
            />
          </div>

          {preview && preview.tableCount > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Detected {preview.tableCount} table{preview.tableCount > 1 ? 's' : ''}
              {preview.relCount > 0 && `, ${preview.relCount} relationship${preview.relCount > 1 ? 's' : ''}`}
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={!sqlText.trim() || importing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {importing ? (
              <>
                <Loader2 className="size-3 mr-1 animate-spin" />
                Parsing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
