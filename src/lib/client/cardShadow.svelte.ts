// Settings > Display > Card Style — Flat/Subtle/Pronounced elevation for the
// same curated card/panel surfaces as card-radius-scale/card-opacity/glassy.
// Same data-attribute pattern as glassy.svelte.ts.
export type CardShadow = 'flat' | 'subtle' | 'pronounced';

const STORAGE_KEY = 'ajar-card-shadow';

export const cardShadowState = $state<{ current: CardShadow }>({ current: 'flat' });

function apply(value: CardShadow) {
	if (value === 'flat') delete document.documentElement.dataset.cardShadow;
	else document.documentElement.dataset.cardShadow = value;
}

export function setCardShadow(value: CardShadow) {
	cardShadowState.current = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, value);
}

export function initCardShadow() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'subtle' || stored === 'pronounced') {
		cardShadowState.current = stored;
		apply(stored);
	}
}
