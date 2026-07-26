const STORAGE_KEY = 'ajar-accent';

export const accentState = $state<{ custom: string | null }>({ custom: null });

function relativeLuminance(hex: string): number {
	const clean = hex.replace('#', '');
	const num = parseInt(clean, 16);
	const [r, g, b] = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever of black/white gives higher WCAG contrast against the chosen color. */
function contrastingTextColor(hex: string): string {
	const bgLum = relativeLuminance(hex);
	const contrastWithWhite = 1.05 / (bgLum + 0.05);
	const contrastWithBlack = (bgLum + 0.05) / 0.05;
	return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
}

// Mirrors static/favicon.svg's bracket mark — recolored to match the custom
// accent so the browser tab reflects it too, not just in-app UI.
const DEFAULT_FAVICON_HREF = '/favicon.svg';

function faviconDataUri(hex: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M 21 5 L 11 5 Q 5 5 5 11 L 5 21 Q 5 27 11 27 L 21 27" fill="none" stroke="${hex}" stroke-width="5" stroke-linecap="round"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function updateFavicon(hex: string | null) {
	const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
	if (!link) return;
	link.href = hex ? faviconDataUri(hex) : DEFAULT_FAVICON_HREF;
}

function apply(hex: string) {
	document.documentElement.style.setProperty('--color-primary', hex);
	document.documentElement.style.setProperty('--color-primary-text', contrastingTextColor(hex));
	updateFavicon(hex);
}

function clear() {
	document.documentElement.style.removeProperty('--color-primary');
	document.documentElement.style.removeProperty('--color-primary-text');
	updateFavicon(null);
}

export function setAccent(hex: string) {
	accentState.custom = hex;
	apply(hex);
	localStorage.setItem(STORAGE_KEY, hex);
}

export function resetAccent() {
	accentState.custom = null;
	clear();
	localStorage.removeItem(STORAGE_KEY);
}

export function initAccent() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		accentState.custom = stored;
		apply(stored);
	}
}
