import { useEffect } from 'react';
import { useStore } from '@/store';

export function useThemeEffect() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
}
