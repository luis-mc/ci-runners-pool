// The colour themes the user can pick (design system tokens.md, Colour themes; UX-60). Only names live here;
// the values are tokens in tokens.css, so a theme changes token values and never a component (UX-55).
export interface ThemeInfo {
  readonly id: string;
  readonly name: string;
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'phosphor', name: 'Phosphor' },
  { id: 'tokyo-night', name: 'Tokyo Night' },
  { id: 'catppuccin', name: 'Catppuccin' },
  { id: 'gruvbox', name: 'Gruvbox' },
  { id: 'solarized', name: 'Solarized' },
  { id: 'nord', name: 'Nord' },
];

/** The theme of a new install, and of a page where none is set. */
export const DEFAULT_THEME_ID = 'tokyo-night';

/** Where the choice is kept in this browser, so the page paints in it before anything loads (public/theme-init.js). */
export const THEME_NAME_KEY = 'crsp.theme-name';
export const THEME_MODE_KEY = 'crsp.theme-mode';

export function isThemeId(value: unknown): value is string {
  return THEMES.some((t) => t.id === value);
}

function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the choice still applies for this visit.
  }
}

/** The saved theme name of this browser, or the default. */
export function savedThemeName(): string {
  try {
    const v = window.localStorage.getItem(THEME_NAME_KEY);
    if (isThemeId(v)) return v;
  } catch {
    // Storage may be blocked.
  }
  return DEFAULT_THEME_ID;
}

/** Applies a theme by name to the page and remembers it for the next first paint. */
export function applyThemeName(id: string): void {
  if (!isThemeId(id)) return;
  document.documentElement.setAttribute('data-theme-name', id);
  remember(THEME_NAME_KEY, id);
}

/** Remembers the mode (system, dark or light) for the next first paint; the server stays the source. */
export function rememberThemeMode(mode: string): void {
  remember(THEME_MODE_KEY, mode);
}
