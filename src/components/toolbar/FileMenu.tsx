import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';
import { generateDDL } from '@/features/sql';
import { generateMermaid } from '@/features/mermaid';
import { toast } from '@/store/toast-store';
import type { ERDSchema } from '@/types/schema';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FileMenu() {
  const handleNewProject = () => {
    const state = useStore.getState();
    state.resetSchema();
    state.resetDiagram();
  };

  const handleSave = () => {
    const state = useStore.getState();
    const project = {
      version: '1.0',
      schema: {
        tables: state.tables,
        relationships: state.relationships,
        layers: {},
      },
      diagramState: {
        nodePositions: state.nodePositions,
        collapsedNodes: state.collapsedNodes,
        viewport: state.viewport,
      },
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'project.erd.json');
    toast('project.erd.json 을 저장했습니다', 'success');
  };

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.erd.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const project = JSON.parse(ev.target?.result as string);
          const state = useStore.getState();

          if (project.schema) {
            state.loadProject({
              tables: project.schema.tables ?? {},
              relationships: project.schema.relationships ?? {},
            });
          }

          if (project.diagramState) {
            state.loadDiagramState({
              nodePositions: project.diagramState.nodePositions ?? {},
              collapsedNodes: project.diagramState.collapsedNodes ?? {},
              viewport: project.diagramState.viewport ?? { x: 0, y: 0, zoom: 1 },
            });
          }

          // 구버전 .erd.json 의 migrations 블록은 무시한다 — 항상 비어 있던 데드 op-log 였고,
          // 실제 마이그레이션 채널은 파일 기반 .mig DSL 이다.
          const n = Object.keys(project.schema?.tables ?? {}).length;
          toast(`${file.name} 을 열었습니다 (테이블 ${n}개)`, 'success');
        } catch (err) {
          // 파싱 실패를 삼키지 않는다 — 파일은 그대로 두고 원인을 남긴다.
          console.error('[erd] .erd.json 열기 실패:', err);
          toast(`${file.name} 열기 실패: 유효한 .erd.json 이 아닙니다`, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportSQL = () => {
    const state = useStore.getState();
    const schema: ERDSchema = { tables: state.tables, relationships: state.relationships, layers: {} };
    const sql = generateDDL(schema, state.dialect);
    const blob = new Blob([sql], { type: 'text/sql' });
    const ext = state.dialect === 'mysql' ? 'mysql' : 'pg';
    downloadBlob(blob, `schema.${ext}.sql`);
    toast(`schema.${ext}.sql 을 내보냈습니다`, 'success');
  };

  const handleExportMermaid = () => {
    const state = useStore.getState();
    const schema: ERDSchema = { tables: state.tables, relationships: state.relationships, layers: {} };
    const text = generateMermaid(schema);
    const blob = new Blob([text], { type: 'text/plain' });
    downloadBlob(blob, 'schema.mermaid');
    toast('schema.mermaid 를 내보냈습니다', 'success');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200">
          File
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={handleNewProject}>New Project</DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpen}>Open (.erd.json)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSave}>Save</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={handleExportSQL}>SQL</DropdownMenuItem>
            <DropdownMenuItem disabled>SVG</DropdownMenuItem>
            <DropdownMenuItem disabled>PNG</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportMermaid}>Mermaid</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
