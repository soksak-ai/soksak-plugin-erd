// Rail bridge — connects this plugin's rail views (navigator/properties) to the bound
// canvas instance (sidebar ejection v1). The canvas App keeps ownership of all state —
// selection, connections, panel prefs — and only rendering leaves through React portals
// into the registered rail containers. Key = the bound content view's id
// (rail ctx.boundViewId ↔ canvas ctx.viewId — 1:1 because the rail slots are per-view).

export type RailSlot = "navigator" | "properties";

const containers = new Map<string, Partial<Record<RailSlot, HTMLElement>>>();
const subs = new Map<string, Set<() => void>>();

function notify(viewId: string) {
  for (const fn of subs.get(viewId) ?? []) fn();
}

// A rail view mount registers its container. Returns the release (call on unmount).
export function registerRailContainer(
  viewId: string,
  slot: RailSlot,
  el: HTMLElement,
): () => void {
  const entry = containers.get(viewId) ?? {};
  entry[slot] = el;
  containers.set(viewId, entry);
  notify(viewId);
  return () => {
    const cur = containers.get(viewId);
    if (!cur || cur[slot] !== el) return;
    delete cur[slot];
    if (!cur.navigator && !cur.properties) containers.delete(viewId);
    else containers.set(viewId, cur);
    notify(viewId);
  };
}

export function railContainer(
  viewId: string | null | undefined,
  slot: RailSlot,
): HTMLElement | null {
  if (!viewId) return null;
  return containers.get(viewId)?.[slot] ?? null;
}

// AppLayout subscribes via useSyncExternalStore.
export function subscribeRail(viewId: string | null | undefined, fn: () => void): () => void {
  if (!viewId) return () => {};
  let set = subs.get(viewId);
  if (!set) {
    set = new Set();
    subs.set(viewId, set);
  }
  set.add(fn);
  return () => {
    const s = subs.get(viewId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subs.delete(viewId);
  };
}
