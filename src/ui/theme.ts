import type { ThemeSetting } from '../settings/settings-store';

/** "system" follows the OS (prefers-color-scheme); light/dark force a theme. */
export function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
