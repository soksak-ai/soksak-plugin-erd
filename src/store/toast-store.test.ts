// Toast channel contract.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore, toast } from './toast-store';

beforeEach(() => {
  useToastStore.setState({ active: [], log: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('toast store', () => {
  it('push adds an active toast and records it in the log', () => {
    const id = toast('saved', 'success');
    const s = useToastStore.getState();
    expect(s.active).toHaveLength(1);
    expect(s.active[0]).toMatchObject({ id, message: 'saved', severity: 'success' });
    expect(s.log[0].message).toBe('saved');
  });

  it('defaults severity to info', () => {
    toast('hi');
    expect(useToastStore.getState().active[0].severity).toBe('info');
  });

  it('newest toast is first and active is capped at 4', () => {
    for (let i = 1; i <= 6; i++) toast(`m${i}`);
    const a = useToastStore.getState().active;
    expect(a).toHaveLength(4);
    expect(a.map((t) => t.message)).toEqual(['m6', 'm5', 'm4', 'm3']);
  });

  it('auto-dismisses after the ttl but keeps the log entry', () => {
    vi.useFakeTimers();
    toast('vanish', 'info', 1000);
    expect(useToastStore.getState().active).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(useToastStore.getState().active).toHaveLength(0);
    expect(useToastStore.getState().log).toHaveLength(1); // 로그는 남는다
  });

  it('ttl of 0 or Infinity does not auto-dismiss', () => {
    vi.useFakeTimers();
    toast('sticky', 'error', 0);
    vi.advanceTimersByTime(100000);
    expect(useToastStore.getState().active).toHaveLength(1);
  });

  it('dismiss removes by id and is idempotent', () => {
    const id = toast('x');
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().active).toHaveLength(0);
    useToastStore.getState().dismiss(id); // no throw, no change
    expect(useToastStore.getState().active).toHaveLength(0);
  });

  it('log is bounded and preserves recency order', () => {
    for (let i = 1; i <= 60; i++) toast(`n${i}`);
    const log = useToastStore.getState().log;
    expect(log.length).toBe(50);
    expect(log[0].message).toBe('n60');
  });
});
