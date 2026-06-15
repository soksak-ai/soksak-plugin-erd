import type { NodePosition, Viewport } from '@/types/diagram';
import type { Relationship, Table } from '@/types/schema';

const RECOVERY_KEY = 'erd:auto-recovery:v1';
const MAX_RECOVERY_ITEMS = 20;

export interface RecoverySnapshot {
  timestamp: number;
  schema: {
    tables: Record<string, Table>;
    relationships: Record<string, Relationship>;
  };
  diagramState: {
    nodePositions: Record<string, NodePosition>;
    collapsedNodes: Record<string, boolean>;
    viewport: Viewport;
  };
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSnapshots(): RecoverySnapshot[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(RECOVERY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecoverySnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSnapshots(items: RecoverySnapshot[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(items));
  } catch {
    // ignore quota/write errors
  }
}

export function pushRecoverySnapshot(snapshot: RecoverySnapshot): void {
  const items = readSnapshots();
  items.push(snapshot);
  if (items.length > MAX_RECOVERY_ITEMS) {
    items.splice(0, items.length - MAX_RECOVERY_ITEMS);
  }
  writeSnapshots(items);
}

export function getLatestRecoverySnapshot(): RecoverySnapshot | null {
  const items = readSnapshots();
  if (items.length === 0) return null;
  return items[items.length - 1] ?? null;
}

export function hasRecoverySnapshot(): boolean {
  return getLatestRecoverySnapshot() !== null;
}
