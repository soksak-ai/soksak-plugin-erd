export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = typeof THEMES[number];
