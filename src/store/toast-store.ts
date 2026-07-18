// Toast/notification channel — the GUI outlet for action feedback.
//
// The plugin's commands already produce human messages, but GUI actions
// (copy, save, export, open) terminated in silence. This store is that outlet:
// GUI handlers push a toast; the Toaster renders it; auto-dismiss clears it.
// A bounded ring keeps the last N toasts so a headless command can read the
// feedback log (status transparency), independent of the DOM host.
import { create } from 'zustand';

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  severity: ToastSeverity;
  /** epoch ms when created (for the readable log); set by the caller-agnostic counter. */
  seq: number;
}

const DEFAULT_TTL_MS = 3000;
const MAX_ACTIVE = 4; // 화면에 겹쳐 쌓이는 활성 토스트 상한
const LOG_CAP = 50; // 헤드리스에서 읽는 최근 로그 상한

interface ToastState {
  active: Toast[]; // 현재 표시 중(자동 소멸 대상)
  log: Toast[]; // 최근 발화 이력(읽기용, 소멸돼도 남음)
  push: (message: string, severity?: ToastSeverity, ttlMs?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
let nextSeq = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  active: [],
  log: [],
  push: (message, severity = 'info', ttlMs = DEFAULT_TTL_MS) => {
    const id = nextId++;
    const toast: Toast = { id, message, severity, seq: nextSeq++ };
    set((s) => ({
      // 최신이 앞(위)에 쌓이고 상한 초과분은 오래된 것부터 밀어낸다.
      active: [toast, ...s.active].slice(0, MAX_ACTIVE),
      log: [toast, ...s.log].slice(0, LOG_CAP),
    }));
    if (ttlMs > 0 && ttlMs < Infinity) {
      setTimeout(() => get().dismiss(id), ttlMs);
    }
    return id;
  },
  dismiss: (id) =>
    set((s) => {
      if (!s.active.some((t) => t.id === id)) return s; // 멱등
      return { active: s.active.filter((t) => t.id !== id) };
    }),
  clear: () => set({ active: [] }),
}));

// non-React 소비자(커맨드 핸들러 등)용 얇은 헬퍼 — store 를 직접 참조하지 않게 한다.
export function toast(message: string, severity?: ToastSeverity, ttlMs?: number): number {
  return useToastStore.getState().push(message, severity, ttlMs);
}
