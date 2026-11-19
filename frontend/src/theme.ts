import { effect } from '@preact/signals';
import type { Theme } from './data/db';
import { theme } from './data/state';

const DARK = 'coverline-dark';
const LIGHT = 'coverline';

export function themeName(choice: Theme, prefersDark: boolean): string {
  if (choice === 'dark') return DARK;
  if (choice === 'light') return LIGHT;
  return prefersDark ? DARK : LIGHT;
}

// Keeps <html data-theme> in step with the chosen theme, and with the device setting when it is "system".
export function watchTheme(): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    document.documentElement.dataset.theme = themeName(theme.value, query.matches);
  };
  effect(apply);
  query.addEventListener('change', apply);
}
