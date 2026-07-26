export type Font = 'default' | 'dyslexic';

const STORAGE_KEY = 'ajar-font';

export const fontState = $state<{ current: Font }>({ current: 'default' });

export function setFont(next: Font) {
	fontState.current = next;
	if (next === 'default') {
		delete document.documentElement.dataset.font;
	} else {
		document.documentElement.dataset.font = next;
	}
	localStorage.setItem(STORAGE_KEY, next);
}

export function initFont() {
	const stored = localStorage.getItem(STORAGE_KEY);
	fontState.current = stored === 'dyslexic' ? 'dyslexic' : 'default';
}
