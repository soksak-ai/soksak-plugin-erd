import { TableNavigator } from '@/components/sidebar/TableNavigator';

export function LeftSidebar() {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800">
      <TableNavigator />
    </div>
  );
}
