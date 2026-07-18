import { useMemo } from 'react';
import { useStore } from '@/store';
import { cn } from '@/lib/utils';
import { Copy, ChevronDown, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateDDL } from '@/features/sql';
import { generateMermaid } from '@/features/mermaid';
import { validateSchema } from '@/features/validation';
import { toast } from '@/store/toast-store';
import type { ERDSchema } from '@/types/schema';
import type { ValidationIssue } from '@/features/validation';

const TABS = [
  { id: 'sql', label: 'SQL' },
  { id: 'mermaid', label: 'Mermaid' },
  { id: 'console', label: 'Console' },
] as const;

function IssueIcon({ level }: { level: ValidationIssue['level'] }) {
  if (level === 'error') return <AlertCircle className="size-3.5 shrink-0 text-red-400" />;
  if (level === 'warning') return <AlertTriangle className="size-3.5 shrink-0 text-yellow-400" />;
  return <Info className="size-3.5 shrink-0 text-blue-400" />;
}

export function BottomPanel() {
  const activeTab = useStore((s) => s.bottomPanelTab);
  const setTab = useStore((s) => s.setBottomPanelTab);
  const togglePanel = useStore((s) => s.toggleBottomPanel);
  const tables = useStore((s) => s.tables);
  const relationships = useStore((s) => s.relationships);
  const dialect = useStore((s) => s.dialect);

  const schema = useMemo<ERDSchema>(
    () => ({ tables, relationships, layers: {} }),
    [tables, relationships],
  );

  const ddl = useMemo(() => generateDDL(schema, dialect), [schema, dialect]);
  const mermaidText = useMemo(() => generateMermaid(schema), [schema]);
  const issues = useMemo(() => validateSchema(schema), [schema]);

  const handleCopy = () => {
    if (activeTab === 'sql') {
      navigator.clipboard.writeText(ddl).then(
        () => toast('SQL 을 클립보드에 복사했습니다', 'success'),
        () => toast('클립보드 복사에 실패했습니다', 'error'),
      );
    } else if (activeTab === 'mermaid') {
      navigator.clipboard.writeText(mermaidText).then(
        () => toast('Mermaid 를 클립보드에 복사했습니다', 'success'),
        () => toast('클립보드 복사에 실패했습니다', 'error'),
      );
    }
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-2">
        <div className="flex items-center gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-node={`panel-tab/${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
              )}
            >
              {tab.label}
              {tab.id === 'console' && issues.some((i) => i.level === 'error') && (
                <span className="ml-1 inline-block size-1.5 rounded-full bg-red-400" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button data-node="panel-copy" variant="ghost" size="icon-xs" className="text-gray-500 dark:text-zinc-500" onClick={handleCopy}>
            <Copy className="size-3" />
          </Button>
          <Button data-node="panel-collapse" variant="ghost" size="icon-xs" className="text-gray-500 dark:text-zinc-500" onClick={togglePanel}>
            <ChevronDown className="size-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'sql' && (
          <pre className="font-mono text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
            <code>{ddl}</code>
          </pre>
        )}
        {activeTab === 'mermaid' && (
          <pre className="font-mono text-sm text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
            <code>{mermaidText}</code>
          </pre>
        )}
        {activeTab === 'console' && (
          <div className="space-y-1">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <IssueIcon level={issue.level} />
                <span
                  className={cn(
                    'text-sm',
                    issue.level === 'error' && 'text-red-400',
                    issue.level === 'warning' && 'text-yellow-400',
                    issue.level === 'info' && 'text-gray-500 dark:text-zinc-500',
                  )}
                >
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
