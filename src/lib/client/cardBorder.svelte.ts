// Settings > Display > Card Style — border width (px) for the same curated
// card/panel surfaces as the other Card Style knobs. A continuous value
// like the radius/opacity sliders, not a preset toggle — border width is
// naturally a number, not a small fixed set of looks.
const STORAGE_KEY = 'ajar-card-border-width';

export const cardBorderState = $state<{ widthPx: number }>({ widthPx: 1 });

function apply(value: number) {
	document.documentElement.style.setProperty('--card-border-width', `${value}px`);
}

export function setCardBorderWidth(value: number) {
	cardBorderState.widthPx = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, String(value));
}

export function initCardBorder() {
	const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? '');
	if (!Number.isNaN(stored)) {
		cardBorderState.widthPx = stored;
		apply(stored);
	}
}
