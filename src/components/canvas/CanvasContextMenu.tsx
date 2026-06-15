import { useCallback, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { usePixiCanvas } from './pixi/PixiCanvasContext';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useStore } from '@/store';
import { Plus, Maximize, Copy, Trash2, Link2Off } from 'lucide-react';

interface CanvasContextMenuProps {
  children: ReactNode;
}

export function CanvasContextMenu({ children }: CanvasContextMenuProps) {
  const canvasApi = usePixiCanvas();
  const addTable = useStore((s) => s.addTable);
  const setNodePosition = useStore((s) => s.setNodePosition);
  const duplicateTable = useStore((s) => s.duplicateTable);
  const removeTable = useStore((s) => s.removeTable);
  const removeRelationship = useStore((s) => s.removeRelationship);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useStore((s) => s.selectedEdgeIds);

  const clickPos = useRef({ x: 0, y: 0 });
  const targetNodeId = useRef<string | null>(null);
  const targetEdgeId = useRef<string | null>(null);
  const [contextKind, setContextKind] = useState<'canvas' | 'node' | 'edge'>('canvas');

  const onContextMenu = useCallback((e: MouseEvent) => {
    clickPos.current = { x: e.clientX, y: e.clientY };
    const edgeId = canvasApi?.hitTestEdgeAt(e.clientX, e.clientY) ?? null;
    targetEdgeId.current = edgeId;
    if (edgeId) {
      targetNodeId.current = null;
      setContextKind('edge');
      return;
    }
    // Hit test via spatial index (no DOM elements for PixiJS nodes)
    targetNodeId.current = canvasApi?.hitTestAt(e.clientX, e.clientY) ?? null;
    setContextKind(targetNodeId.current ? 'node' : 'canvas');
  }, [canvasApi]);

  const handleAddTable = useCallback(() => {
    const worldPos = canvasApi?.screenToWorld(clickPos.current.x, clickPos.current.y);
    const position = worldPos ?? { x: 0, y: 0 };
    const newId = addTable({ name: 'new_table' });
    setNodePosition(newId, position);
  }, [canvasApi, addTable, setNodePosition]);

  const handleFitView = useCallback(() => {
    useStore.getState().fitViewFn?.();
  }, []);

  const handleDuplicate = useCallback(() => {
    const nodeId = targetNodeId.current ?? selectedNodeIds[0];
    if (nodeId) {
      duplicateTable(nodeId);
    }
  }, [duplicateTable, selectedNodeIds]);

  const handleDelete = useCallback(() => {
    const nodeId = targetNodeId.current ?? selectedNodeIds[0];
    if (nodeId) {
      removeTable(nodeId);
    }
  }, [removeTable, selectedNodeIds]);

  const handleDeleteRelationship = useCallback(() => {
    const edgeId = targetEdgeId.current ?? selectedEdgeIds[0];
    if (edgeId) {
      removeRelationship(edgeId);
    }
  }, [removeRelationship, selectedEdgeIds]);

  const isNodeContext = contextKind === 'node' || (contextKind === 'canvas' && selectedNodeIds.length > 0);
  const isEdgeContext = contextKind === 'edge' || (contextKind === 'canvas' && selectedEdgeIds.length > 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {contextKind !== 'edge' && (
          <>
            <ContextMenuItem onClick={handleAddTable}>
              <Plus className="size-4" />
              Add Table Here
            </ContextMenuItem>
            <ContextMenuItem onClick={handleFitView}>
              <Maximize className="size-4" />
              Fit View
            </ContextMenuItem>
          </>
        )}
        {isNodeContext && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleDuplicate}>
              <Copy className="size-4" />
              Duplicate
            </ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </ContextMenuItem>
          </>
        )}
        {isEdgeContext && (
          <>
            {contextKind !== 'edge' && <ContextMenuSeparator />}
            <ContextMenuItem variant="destructive" onClick={handleDeleteRelationship}>
              <Link2Off className="size-4" />
              Delete Relationship
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
