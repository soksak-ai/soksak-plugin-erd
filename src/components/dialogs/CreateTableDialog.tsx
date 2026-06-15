import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/store';
import { DATA_TYPES } from '@/constants/data-types';
import { generateId } from '@/lib/id';
import type { Column } from '@/types/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';

interface DialogColumn {
  id: string;
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  nullable: boolean;
  autoIncrement: boolean;
}

function createInitialColumns(): DialogColumn[] {
  return [
    {
      id: generateId(),
      name: 'id',
      dataType: 'INT',
      isPrimaryKey: true,
      nullable: false,
      autoIncrement: true,
    },
  ];
}

export function CreateTableDialog() {
  const open = useStore((s) => s.createTableDialogOpen);
  const setOpen = useStore((s) => s.setCreateTableDialogOpen);
  const addTable = useStore((s) => s.addTable);
  const setNodePosition = useStore((s) => s.setNodePosition);
  const dialect = useStore((s) => s.dialect);
  const dataTypes = DATA_TYPES[dialect] ?? DATA_TYPES['mysql'];

  const [tableName, setTableName] = useState('');
  const [schema, setSchema] = useState('public');
  const [columns, setColumns] = useState<DialogColumn[]>(createInitialColumns);
  const creatingRef = useRef(false);

  const resetForm = useCallback(() => {
    setTableName('');
    setSchema('public');
    setColumns(createInitialColumns());
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) resetForm();
    },
    [setOpen, resetForm]
  );

  const addColumnRow = useCallback(() => {
    setColumns((prev) => [
      ...prev,
      {
        id: generateId(),
        name: '',
        dataType: 'VARCHAR',
        isPrimaryKey: false,
        nullable: true,
        autoIncrement: false,
      },
    ]);
  }, []);

  const updateColumnRow = useCallback((id: string, updates: Partial<DialogColumn>) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const removeColumnRow = useCallback((id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleCreate = useCallback(() => {
    if (creatingRef.current) return;
    const name = tableName.trim();
    if (!name) return;
    creatingRef.current = true;

    const tableColumns: Array<Partial<Column> & { name: string }> = columns
      .filter((c) => c.name.trim())
      .map((c) => ({
        id: generateId(),
        name: c.name.trim(),
        dataType: c.dataType,
        isPrimaryKey: c.isPrimaryKey,
        nullable: c.nullable,
        autoIncrement: c.autoIncrement,
        isUnique: false,
      }));

    const id = addTable({
      name,
      schema: dialect === 'postgresql' ? schema : undefined,
      columns: tableColumns.length > 0 ? (tableColumns as Column[]) : undefined,
    });

    setNodePosition(id, {
      x: Math.random() * 400 + 100,
      y: Math.random() * 400 + 100,
    });

    setOpen(false);
    resetForm();
    queueMicrotask(() => {
      creatingRef.current = false;
    });
  }, [tableName, columns, dialect, schema, addTable, setNodePosition, setOpen, resetForm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, columnIndex: number) => {
      if (e.key === 'Enter' && columnIndex === columns.length - 1) {
        e.preventDefault();
        addColumnRow();
      }
    },
    [columns.length, addColumnRow]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>Define the table name and initial columns.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Table Name</label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="table_name"
              className="font-mono"
              autoFocus
              onKeyDown={(e) => {
                const isComposing = (e.nativeEvent as KeyboardEvent).isComposing;
                if (isComposing) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreate();
                }
              }}
            />
          </div>

          {dialect === 'postgresql' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Schema</label>
              <Input
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder="public"
              />
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <label className="text-sm font-medium">Columns</label>
            <div className="space-y-2">
              {columns.map((col, index) => (
                <div key={col.id} className="flex items-center gap-2">
                  <Input
                    value={col.name}
                    onChange={(e) => updateColumnRow(col.id, { name: e.target.value })}
                    placeholder="column_name"
                    className="h-8 text-xs font-mono flex-1"
                    onKeyDown={(e) => handleKeyDown(e, index)}
                  />
                  <Select
                    value={col.dataType}
                    onValueChange={(value) => updateColumnRow(col.id, { dataType: value })}
                  >
                    <SelectTrigger size="sm" className="h-8 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-xs">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-0.5 shrink-0">
                    <Checkbox
                      checked={col.isPrimaryKey}
                      onCheckedChange={(checked) =>
                        updateColumnRow(col.id, { isPrimaryKey: !!checked })
                      }
                      className="size-3.5"
                    />
                    <span className="text-[10px] text-muted-foreground">PK</span>
                  </label>
                  <label className="flex items-center gap-0.5 shrink-0">
                    <Checkbox
                      checked={!col.nullable}
                      onCheckedChange={(checked) =>
                        updateColumnRow(col.id, { nullable: !checked })
                      }
                      className="size-3.5"
                    />
                    <span className="text-[10px] text-muted-foreground">NN</span>
                  </label>
                  <label className="flex items-center gap-0.5 shrink-0">
                    <Checkbox
                      checked={col.autoIncrement}
                      onCheckedChange={(checked) =>
                        updateColumnRow(col.id, { autoIncrement: !!checked })
                      }
                      className="size-3.5"
                    />
                    <span className="text-[10px] text-muted-foreground">AI</span>
                  </label>
                  <button
                    onClick={() => removeColumnRow(col.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="xs" onClick={addColumnRow} className="w-full">
              <Plus className="size-3.5" />
              Add Column
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!tableName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
