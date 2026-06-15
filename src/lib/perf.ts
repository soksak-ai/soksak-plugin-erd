// Performance profiling utility
// Toggle: window.__ERD_PERF = true/false in browser console

const PERF_KEY = '__ERD_PERF';

function isEnabled(): boolean {
  return typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)[PERF_KEY] === true;
}

const timers = new Map<string, number>();
const metrics = new Map<string, number[]>();

export const perf = {
  enable() {
    (window as unknown as Record<string, unknown>)[PERF_KEY] = true;
    console.log('%c[PERF] Profiling ENABLED', 'color: #10b981; font-weight: bold');
  },

  disable() {
    (window as unknown as Record<string, unknown>)[PERF_KEY] = false;
    console.log('%c[PERF] Profiling DISABLED', 'color: #ef4444; font-weight: bold');
  },

  start(label: string) {
    if (!isEnabled()) return;
    timers.set(label, performance.now());
  },

  end(label: string) {
    if (!isEnabled()) return;
    const start = timers.get(label);
    if (start === undefined) return;
    const duration = performance.now() - start;
    timers.delete(label);

    if (!metrics.has(label)) metrics.set(label, []);
    metrics.get(label)!.push(duration);

    const color = duration > 100 ? '#ef4444' : duration > 16 ? '#f59e0b' : '#10b981';
    console.log(`%c[PERF] ${label}: ${duration.toFixed(1)}ms`, `color: ${color}`);
    return duration;
  },

  measure<T>(label: string, fn: () => T): T {
    if (!isEnabled()) return fn();
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (!metrics.has(label)) metrics.set(label, []);
    metrics.get(label)!.push(duration);

    const color = duration > 100 ? '#ef4444' : duration > 16 ? '#f59e0b' : '#10b981';
    console.log(`%c[PERF] ${label}: ${duration.toFixed(1)}ms`, `color: ${color}`);
    return result;
  },

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!isEnabled()) return fn();
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (!metrics.has(label)) metrics.set(label, []);
    metrics.get(label)!.push(duration);

    const color = duration > 100 ? '#ef4444' : duration > 16 ? '#f59e0b' : '#10b981';
    console.log(`%c[PERF] ${label}: ${duration.toFixed(1)}ms`, `color: ${color}`);
    return result;
  },

  report() {
    if (metrics.size === 0) {
      console.log('%c[PERF] No metrics recorded. Run perf.enable() first.', 'color: #71717a');
      return;
    }
    console.log('%c[PERF] === Performance Report ===', 'color: #3b82f6; font-weight: bold; font-size: 14px');
    console.table(
      Object.fromEntries(
        [...metrics.entries()].map(([label, values]) => [
          label,
          {
            calls: values.length,
            avg: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
            min: +Math.min(...values).toFixed(1),
            max: +Math.max(...values).toFixed(1),
            last: +values[values.length - 1].toFixed(1),
            total: +values.reduce((a, b) => a + b, 0).toFixed(1),
          },
        ])
      )
    );
  },

  reset() {
    metrics.clear();
    timers.clear();
    console.log('%c[PERF] Metrics reset', 'color: #71717a');
  },
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).perf = perf;
}
