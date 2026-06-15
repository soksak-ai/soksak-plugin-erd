import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/store';
import { perf } from '@/lib/perf';
import { computeLayoutCenter, computeSeedLayout } from '@/features/layout/seed-layout';
import type { MWBWorkerResponse } from '@/workers/mwb.worker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileArchive, Loader2 } from 'lucide-react';

function createMWBWorker() {
  return new Worker(
    new URL('@/workers/mwb.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

export function ImportMWBDialog() {
  const open = useStore((s) => s.importMWBDialogOpen);
  const setOpen = useStore((s) => s.setImportMWBDialogOpen);
  const loadSchema = useStore((s) => s.loadSchema);
  const clearSchema = useStore((s) => s.clearSchema);
  const setNodePositions = useStore((s) => s.setNodePositions);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [preview, setPreview] = useState<{ tableCount: number; relCount: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const resetForm = useCallback(() => {
    setFile(null);
    setError(null);
    setPreview(null);
    setParsing(false);
    setProgress('');
    setMode('replace');
  }, []);

  const parseWithWorker = useCallback((f: File, isPreview: boolean) => {
    workerRef.current?.terminate();

    const worker = createMWBWorker();
    workerRef.current = worker;
    setParsing(true);
    setError(null);

    if (!isPreview) {
      perf.start('import:parseMWB');
    }

    worker.onmessage = (e: MessageEvent<MWBWorkerResponse>) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        setProgress(msg.step ?? '');
        return;
      }

      if (msg.type === 'error') {
        setError(msg.message ?? 'Parsing failed');
        setParsing(false);
        worker.terminate();
        return;
      }

      if (msg.type === 'parseResult' && msg.schema) {
        const tableCount = Object.keys(msg.schema.tables).length;
        const relCount = Object.keys(msg.schema.relationships).length;

        if (isPreview) {
          setPreview({ tableCount, relCount });
          setParsing(false);
        } else {
          perf.end('import:parseMWB');

          if (tableCount === 0) {
            setError('No tables found in the .mwb file.');
            setParsing(false);
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

          const seedTables = Object.values(msg.schema.tables).map((t) => ({
            id: t.id,
            name: t.name,
            columnCount: t.columns.length,
          }));
          const seedPositions = computeSeedLayout(seedTables, { startX, startY: 0 });
          setNodePositions(seedPositions);

          perf.start('import:loadSchema');
          loadSchema(msg.schema.tables, msg.schema.relationships);
          perf.end('import:loadSchema');

          if (mode === 'replace') {
            const center = computeLayoutCenter(seedPositions);
            if (center) {
              store.setViewport({ x: center.x, y: center.y, zoom: 1 });
            }
          }

          setOpen(false);
          resetForm();
        }

        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setError(err.message || 'Worker error');
      setParsing(false);
      worker.terminate();
    };

    // Read file as ArrayBuffer and send to worker
    f.arrayBuffer().then(buffer => {
      worker.postMessage({ type: 'parseMWB', payload: { buffer } }, [buffer]);
    });
  }, [mode, clearSchema, loadSchema, setNodePositions, setOpen, resetForm]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(null);
    parseWithWorker(f, true); // preview parse
  }, [parseWithWorker]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith('.mwb')) {
      handleFile(f);
    } else {
      setError('Please drop a .mwb file.');
    }
  }, [handleFile]);

  const handleImport = useCallback(() => {
    if (!file) return;
    parseWithWorker(file, false); // full import
  }, [file, parseWithWorker]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      workerRef.current?.terminate();
      resetForm();
    }
  }, [setOpen, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import MySQL Workbench File</DialogTitle>
          <DialogDescription>Upload a .mwb file to import tables and relationships.</DialogDescription>
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

          <div
            className={`
              flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer
              ${isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : file
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {parsing ? (
              <Loader2 className="size-8 text-blue-500 animate-spin" />
            ) : file ? (
              <FileArchive className="size-8 text-green-500" />
            ) : (
              <Upload className="size-8 text-zinc-400" />
            )}
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {parsing ? progress : file ? file.name : 'Drop .mwb file here or click to browse'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mwb"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {preview && (
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
            disabled={!file || parsing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {parsing ? (
              <>
                <Loader2 className="size-3 mr-1 animate-spin" />
                {progress || 'Parsing...'}
              </>
            ) : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
