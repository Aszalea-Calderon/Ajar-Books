// A separate toggle from card opacity (see cardStyle.svelte.ts) — opacity
// alone just fades the background color, this adds a frosted-glass blur of
// whatever's behind the card. Same data-attribute pattern as theme/font/
// background-texture.
const STORAGE_KEY = 'ajar-glassy';

export const glassyState = $state<{ enabled: boolean }>({ enabled: false });

export function setGlassy(enabled: boolean) {
	glassyState.enabled = enabled;
	if (enabled) document.documentElement.dataset.glassy = 'true';
	else delete document.documentElement.dataset.glassy;
	localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function initGlassy() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'true') {
		glassyState.enabled = true;
		document.documentElement.dataset.glassy = 'true';
	}
}
