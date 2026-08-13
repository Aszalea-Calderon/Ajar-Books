// Settings > Display > Card Style — None/Thin/Bold border weight for the
// same curated card/panel surfaces as the other Card Style knobs.
export type CardBorder = 'none' | 'thin' | 'bold';

const STORAGE_KEY = 'ajar-card-border';

const WIDTH: Record<CardBorder, string> = {
	none: '0px',
	thin: '1px',
	bold: '2px'
};

export const cardBorderState = $state<{ current: CardBorder }>({ current: 'thin' });

function apply(value: CardBorder) {
	document.documentElement.style.setProperty('--card-border-width', WIDTH[value]);
}

export function setCardBorder(value: CardBorder) {
	cardBorderState.current = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, value);
}

export function initCardBorder() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'none' || stored === 'thin' || stored === 'bold') {
		cardBorderState.current = stored;
		apply(stored);
	}
}
