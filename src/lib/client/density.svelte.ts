// Settings > Display > Spacing Density — scales the --space-* tokens at
// their source (see app.css), so it affects padding/gaps app-wide with no
// per-selector changes needed.
export type Density = 'compact' | 'comfortable' | 'spacious';

const STORAGE_KEY = 'ajar-density';

const SCALE: Record<Density, number> = {
	compact: 0.75,
	comfortable: 1,
	spacious: 1.25
};

export const densityState = $state<{ current: Density }>({ current: 'comfortable' });

function apply(value: Density) {
	document.documentElement.style.setProperty('--density-scale', String(SCALE[value]));
}

export function setDensity(value: Density) {
	densityState.current = value;
	apply(value);
	localStorage.setItem(STORAGE_KEY, value);
}

export function initDensity() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'compact' || stored === 'spacious') {
		densityState.current = stored;
		apply(stored);
	}
}
