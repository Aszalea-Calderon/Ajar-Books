// Display knobs beyond theme/accent/background/font — corner rounding and
// background opacity for card/panel surfaces, plus corner rounding for
// primary action buttons, independently (see the --card-radius-scale/
// --card-opacity/--control-radius-scale tokens in app.css, and the curated
// sets of selectors that consume each). Same override-a-CSS-custom-property
// pattern as accent.svelte.ts: 1 means "no override, use the design
// default", not "0% radius" or "0% opacity".
const RADIUS_STORAGE_KEY = 'ajar-card-radius-scale';
const OPACITY_STORAGE_KEY = 'ajar-card-opacity';
const CONTROL_RADIUS_STORAGE_KEY = 'ajar-control-radius-scale';

export const cardStyleState = $state<{
	radiusScale: number;
	opacity: number;
	controlRadiusScale: number;
}>({
	radiusScale: 1,
	opacity: 1,
	controlRadiusScale: 1
});

function applyRadiusScale(value: number) {
	document.documentElement.style.setProperty('--card-radius-scale', String(value));
}

function applyOpacity(value: number) {
	document.documentElement.style.setProperty('--card-opacity', String(value));
}

function applyControlRadiusScale(value: number) {
	document.documentElement.style.setProperty('--control-radius-scale', String(value));
}

export function setCardRadiusScale(value: number) {
	cardStyleState.radiusScale = value;
	applyRadiusScale(value);
	localStorage.setItem(RADIUS_STORAGE_KEY, String(value));
}

export function setCardOpacity(value: number) {
	cardStyleState.opacity = value;
	applyOpacity(value);
	localStorage.setItem(OPACITY_STORAGE_KEY, String(value));
}

export function setControlRadiusScale(value: number) {
	cardStyleState.controlRadiusScale = value;
	applyControlRadiusScale(value);
	localStorage.setItem(CONTROL_RADIUS_STORAGE_KEY, String(value));
}

export function initCardStyle() {
	const storedRadius = parseFloat(localStorage.getItem(RADIUS_STORAGE_KEY) ?? '');
	if (!Number.isNaN(storedRadius)) {
		cardStyleState.radiusScale = storedRadius;
		applyRadiusScale(storedRadius);
	}
	const storedOpacity = parseFloat(localStorage.getItem(OPACITY_STORAGE_KEY) ?? '');
	if (!Number.isNaN(storedOpacity)) {
		cardStyleState.opacity = storedOpacity;
		applyOpacity(storedOpacity);
	}
	const storedControlRadius = parseFloat(localStorage.getItem(CONTROL_RADIUS_STORAGE_KEY) ?? '');
	if (!Number.isNaN(storedControlRadius)) {
		cardStyleState.controlRadiusScale = storedControlRadius;
		applyControlRadiusScale(storedControlRadius);
	}
}
