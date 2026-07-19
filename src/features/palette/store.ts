// Command palette open-state — a tiny store so the palette can be opened by the
// ⌘K hotkey, by a menu, or headlessly by a command (open-state transparency).
import { create } from 'zustand';

interface PaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const usePaletteStore = create<PaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
