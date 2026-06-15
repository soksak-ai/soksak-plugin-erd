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
import { Loader2 } from 'lucide-react';

function createImportWorker() {
  // 번들 플러그인(blob ESM): import.meta.url URL 워커 불가 → IIFE 문자열을 blob 워커로.
  return blobWorker(__ERD_WORKER_IMPORT__);
}

export function ImportMermaidDialog() {
  const open = useStore((s) => s.importMermaidDialogOpen);
  const setOpen = useStore((s) => s.setImportMermaidDialogOpen);
  const loadSchema = useStore((s) => s.loadSchema);
  const clearSchema = useStore((s) => s.clearSchema);
  const setNodePositions = useStore((s) => s.setNodePositions);

  const [mermaidText, setMermaidText] = useState('');
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ tableCount: number; relCount: number } | null>(null);
  const previewWorkerRef = useRef<Worker | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced preview via worker
  useEffect(() => {
    if (!mermaidText.trim()) {
      return;
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      previewWorkerRef.current?.terminate();

      const worker = createImportWorker();
      previewWorkerRef.current = worker;

      worker.onmessage = (e: MessageEvent<ImportWorkerResponse>) => {
        if (e.data.type === 'parseResult') {
          const tableCount = Object.keys(e.data.schema.tables).length;
          const relCount = Object.keys(e.data.schema.relationships).length;
          setPreview({ tableCount, relCount });
        } else if (e.data.type === 'error') {
          setPreview(null);
        }
        worker.terminate();
        if (previewWorkerRef.current === worker) {
          previewWorkerRef.current = null;
        }
      };

      worker.postMessage({
        type: 'parseMermaid',
        payload: { text: mermaidText },
      } satisfies ImportWorkerRequest);
    }, 300);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [mermaidText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      previewWorkerRef.current?.terminate();
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const resetForm = useCallback(() => {
    setMermaidText('');
    setError(null);
    setPreview(null);
    setMode('replace');
  }, []);

  const handleImport = useCallback(() => {
    if (importing) return;
    setImporting(true);
    setError(null);

    perf.start('import:parseMermaid');
    const worker = createImportWorker();

    worker.onmessage = (e: MessageEvent<ImportWorkerResponse>) => {
      perf.end('import:parseMermaid');

      if (e.data.type === 'error') {
        setError(e.data.message);
        setImporting(false);
        worker.terminate();
        return;
      }

      const { schema } = e.data;
      const tableCount = Object.keys(schema.tables).length;
      if (tableCount === 0) {
        setError('No entities found in the Mermaid text.');
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
      perf.end('import:parseMermaid');
      setError(err.message || 'Worker error during Mermaid parsing.');
      setImporting(false);
      worker.terminate();
    };

    worker.postMessage({
      type: 'parseMermaid',
      payload: { text: mermaidText },
    } satisfies ImportWorkerRequest);
  }, [mermaidText, mode, clearSchema, loadSchema, setNodePositions, setOpen, importing, resetForm]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }, [setOpen, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Mermaid</DialogTitle>
          <DialogDescription>Paste a Mermaid erDiagram to import tables and relationships.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Import Mode</label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'replace' | 'merge')}>
              <SelectTrigger size="sm" className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace All</SelectItem>
                <SelectItem value="merge">Merge</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Mermaid erDiagram</label>
            <Textarea
              value={mermaidText}
              onChange={(e) => { setMermaidText(e.target.value); setError(null); setPreview(null); }}
              placeholder={'erDiagram\n    USERS {\n        int id PK\n        varchar name\n    }'}
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
            disabled={!mermaidText.trim() || importing}
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
