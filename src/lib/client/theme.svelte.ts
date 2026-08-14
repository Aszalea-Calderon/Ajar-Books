import { reapplyAccentForTheme } from './accent.svelte';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ajar-theme';

export const themeState = $state<{ current: Theme }>({ current: 'dark' });

export function setTheme(next: Theme) {
	themeState.current = next;
	document.documentElement.dataset.theme = next;
	localStorage.setItem(STORAGE_KEY, next);
	// --color-link (see accent.svelte.ts) is computed against the theme's
	// background, so a custom accent's safe-link-color needs recomputing
	// whenever the background it was checked against changes.
	reapplyAccentForTheme();
}

export function initTheme() {
	const stored = localStorage.getItem(STORAGE_KEY);
	themeState.current = stored === 'light' ? 'light' : 'dark';
}
