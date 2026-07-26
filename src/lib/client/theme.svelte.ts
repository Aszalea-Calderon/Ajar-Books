export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'ajar-theme';

export const themeState = $state<{ current: Theme }>({ current: 'dark' });

export function setTheme(next: Theme) {
	themeState.current = next;
	document.documentElement.dataset.theme = next;
	localStorage.setItem(STORAGE_KEY, next);
}

export function initTheme() {
	const stored = localStorage.getItem(STORAGE_KEY);
	themeState.current = stored === 'light' ? 'light' : 'dark';
}
