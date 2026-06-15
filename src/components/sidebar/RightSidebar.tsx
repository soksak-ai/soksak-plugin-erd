import { PropertyEditor } from '@/components/sidebar/PropertyEditor';

export function RightSidebar() {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800">
      <PropertyEditor />
    </div>
  );
}
