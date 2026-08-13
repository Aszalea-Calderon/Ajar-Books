// Settings > Display > Card Style — corner rounding for book cover images
// specifically, independent of card-radius-scale (the card containing a
// cover) and control-radius-scale (buttons). Same override-a-CSS-custom-
// property pattern as cardStyle.svelte.ts.
const STORAGE_KEY = 'ajar-cover-radius-scale';

export const coverStyleState = $state<{ radiusScale: number }>({ radiusScale: 1 });

function apply(value: number) {
	document.documentElement.style.setProperty('--cover-radius-scale', String(value));
}

export function setCoverRadiusScale(value: number) {
	coverStyleState.radiusScale = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, String(value));
}

export function initCoverStyle() {
	const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
	if (!Number.isNaN(stored)) {
		coverStyleState.radiusScale = stored;
		apply(stored);
	}
}
