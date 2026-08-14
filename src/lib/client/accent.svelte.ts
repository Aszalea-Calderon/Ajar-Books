const STORAGE_KEY = 'ajar-accent';

export const accentState = $state<{ custom: string | null }>({ custom: null });

// Mirrors app.css's :root/[data-theme='light'] --color-bg values — hardcoded
// rather than read via getComputedStyle so this works even before first
// paint and doesn't depend on theme.svelte.ts's init order.
const THEME_BG: Record<'dark' | 'light', string> = { dark: '#12141a', light: '#f7f8fa' };

function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace('#', '');
	const num = parseInt(clean, 16);
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
	return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
	const [rl, gl, bl] = [r, g, b].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

export function contrastRatio(hexA: string, hexB: string): number {
	const lumA = relativeLuminance(hexToRgb(hexA));
	const lumB = relativeLuminance(hexToRgb(hexB));
	const [lighter, darker] = lumA >= lumB ? [lumA, lumB] : [lumB, lumA];
	return (lighter + 0.05) / (darker + 0.05);
}

/** Whichever of black/white gives higher WCAG contrast against the chosen color. */
function contrastingTextColor(hex: string): string {
	const bgLum = relativeLuminance(hexToRgb(hex));
	const contrastWithWhite = 1.05 / (bgLum + 0.05);
	const contrastWithBlack = (bgLum + 0.05) / 0.05;
	return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
	const [rn, gn, bn] = [r / 255, g / 255, b / 255];
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
	else if (max === gn) h = ((bn - rn) / d + 2) * 60;
	else h = ((rn - gn) / d + 4) * 60;
	return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
	if (s === 0) return [l * 255, l * 255, l * 255];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hueToRgb = (t: number) => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};
	const hn = h / 360;
	return [hueToRgb(hn + 1 / 3) * 255, hueToRgb(hn) * 255, hueToRgb(hn - 1 / 3) * 255];
}

const MIN_TEXT_CONTRAST = 4.5;

/**
 * The accent color as-is if it already reads clearly as text on the current
 * theme's page background (e.g. link color) — otherwise the same hue/
 * saturation nudged darker or lighter (toward whichever end away from the
 * background) until it clears WCAG AA's 4.5:1 text contrast, so a picked
 * accent can never render as a near-invisible link.
 */
export function safeTextColor(hex: string, bgHex: string): string {
	if (contrastRatio(hex, bgHex) >= MIN_TEXT_CONTRAST) return hex;

	const bgLum = relativeLuminance(hexToRgb(bgHex));
	const goDarker = bgLum >= 0.5; // light background → darken the accent, and vice versa
	const [h, s, l] = rgbToHsl(hexToRgb(hex));

	const STEPS = 20;
	for (let i = 1; i <= STEPS; i++) {
		const l2 = goDarker ? l * (1 - i / STEPS) : l + (1 - l) * (i / STEPS);
		const candidate = rgbToHex(hslToRgb([h, s, l2]));
		if (contrastRatio(candidate, bgHex) >= MIN_TEXT_CONTRAST) return candidate;
	}
	// Fallback for a saturated color that can't reach 4.5:1 without going
	// fully to black/white first — same choice contrastingTextColor makes.
	return goDarker ? '#000000' : '#ffffff';
}

function currentThemeBg(): string {
	return document.documentElement.dataset.theme === 'light' ? THEME_BG.light : THEME_BG.dark;
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
	document.documentElement.style.setProperty('--color-link', safeTextColor(hex, currentThemeBg()));
	updateFavicon(hex);
}

function clear() {
	document.documentElement.style.removeProperty('--color-primary');
	document.documentElement.style.removeProperty('--color-primary-text');
	document.documentElement.style.removeProperty('--color-link');
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

// The safe-link-color computation depends on the current theme's background,
// so a theme switch with a custom accent already active needs to redo it —
// otherwise --color-link stays computed against the *previous* theme's
// background. Called from theme.svelte.ts's setTheme. A no-op when there's
// no custom accent, since --color-link then just falls back to the default
// --color-primary token in app.css.
export function reapplyAccentForTheme() {
	if (accentState.custom) apply(accentState.custom);
}
