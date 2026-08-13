// Settings > Display > Text Size — scales the --font-size-* tokens at their
// source (see app.css), same technique as density.svelte.ts's spacing
// scale, so it affects type app-wide with no per-selector changes needed.
const STORAGE_KEY = 'ajar-text-scale';

export const textScaleState = $state<{ scale: number }>({ scale: 1 });

function apply(value: number) {
	document.documentElement.style.setProperty('--text-scale', String(value));
}

export function setTextScale(value: number) {
	textScaleState.scale = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, String(value));
}

export function initTextScale() {
	const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
	if (!Number.isNaN(stored)) {
		textScaleState.scale = stored;
		apply(stored);
	}
}
