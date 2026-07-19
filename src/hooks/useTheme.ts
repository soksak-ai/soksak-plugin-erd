import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { resolveHostMode } from '@/features/theme/host';

// Run `onChange` once on mount and again whenever the host theme changes. The host publishes a
// single change signal (data-theme-epoch) alongside data-theme-mode; we also follow the OS
// preference for hosts that defer to the system. Single source for every canvas surface that must
// repaint on theme change (PixiERDCanvas palette, Minimap). Never writes the host root.
export function useHostThemeEpoch(onChange: () => void): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const root = document.documentElement;
    const fire = () => cb.current();
    fire();
    const obs = new MutationObserver(fire);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme-mode', 'data-theme-epoch'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', fire);
    return () => {
      obs.disconnect();
      mq?.removeEventListener?.('change', fire);
    };
  }, []);
}

// Follow the host theme mode. The host owns the theme; the plugin never writes the host root
// (the previous useThemeEffect stamped document.documentElement, which fought the host and pinned
// the plugin to its own default). We read data-theme-mode off document.documentElement and mirror
// the effective light/dark into the store (transient — chrome-prefs persistence excludes theme).
// App mirrors store.theme onto the shadow host so Tailwind `dark:` variants resolve inside the
// Shadow DOM. Re-read on the host's single change signal (data-theme-epoch) plus data-theme-mode,
// and on OS preference changes when the host defers to the system.
export function useHostThemeSync() {
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(resolveHostMode(root));
    sync();

    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme-mode', 'data-theme-epoch'] });

    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', sync);

    return () => {
      obs.disconnect();
      mq?.removeEventListener?.('change', sync);
    };
  }, [setTheme]);
}
