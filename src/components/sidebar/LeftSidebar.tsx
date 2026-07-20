import { TableNavigator } from '@/components/sidebar/TableNavigator';
import { ConnectionsContainer } from '@/components/connections/ConnectionsContainer';

export function LeftSidebar() {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800">
      <div className="min-h-0 flex-1 overflow-auto">
        <TableNavigator />
      </div>
      {/* Connection profiles (live-DB). Null in the plain-web dev path (no core bridge). */}
      <div className="shrink-0">
        <ConnectionsContainer />
      </div>
    </div>
  );
}
