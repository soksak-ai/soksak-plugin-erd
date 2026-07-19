// ⌘K command palette — a searchable index of every operable action, built from
// the palette action registry. Opened by ⌘K/Ctrl+K, a menu, or a headless command.
import { useEffect, useMemo } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { usePaletteStore } from '@/features/palette/store';
import { buildPaletteActions, type PaletteAction } from '@/features/palette/actions';

const GROUP_ORDER: PaletteAction['group'][] = ['Create', 'Edit', 'View', 'Export', 'Navigate'];

export function CommandPalette() {
  const open = usePaletteStore((s) => s.open);
  const setOpen = usePaletteStore((s) => s.setOpen);
  const toggle = usePaletteStore((s) => s.toggle);

  // ⌘K / Ctrl+K 전역 토글. input 포커스 여부와 무관하게 팔레트를 연다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // 열릴 때 현재 상태 기준으로 액션 목록을 구성(테이블 목록 반영).
  const actions = useMemo(() => (open ? buildPaletteActions() : []), [open]);
  const groups = useMemo(() => {
    const byGroup = new Map<PaletteAction['group'], PaletteAction[]>();
    for (const a of actions) {
      const list = byGroup.get(a.group) ?? [];
      list.push(a);
      byGroup.set(a.group, list);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, items: byGroup.get(g)! }));
  }, [actions]);

  const run = (action: PaletteAction) => {
    setOpen(false);
    action.run();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="명령 팔레트" description="명령을 검색해 실행하세요">
      <div data-node="command-palette">
        <CommandInput placeholder="명령 검색… (⌘K)" />
        <CommandList>
          <CommandEmpty>일치하는 명령이 없습니다</CommandEmpty>
          {groups.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map((a) => (
                <CommandItem
                  key={a.id}
                  data-node={`palette-item/${a.id.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`}
                  value={`${a.label} ${a.keywords ?? ''}`}
                  onSelect={() => run(a)}
                >
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
