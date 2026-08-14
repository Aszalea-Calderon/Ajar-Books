import { describe, expect, it } from 'vitest';
import { contrastRatio, safeTextColor } from './accent.svelte';

const DARK_BG = '#12141a';
const LIGHT_BG = '#f7f8fa';
const MIN_TEXT_CONTRAST = 4.5;

describe('safeTextColor', () => {
	it('leaves an already-readable color unchanged', () => {
		// The app's own default accents — picked to already read fine as text.
		expect(safeTextColor('#4c8edb', DARK_BG)).toBe('#4c8edb');
		expect(safeTextColor('#1d5fa8', LIGHT_BG)).toBe('#1d5fa8');
	});

	it('darkens a too-light accent for a light background', () => {
		const result = safeTextColor('#fdf6e3', LIGHT_BG);
		expect(result).not.toBe('#fdf6e3');
		expect(contrastRatio(result, LIGHT_BG)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
	});

	it('lightens a too-dark accent for a dark background', () => {
		const result = safeTextColor('#0a1128', DARK_BG);
		expect(result).not.toBe('#0a1128');
		expect(contrastRatio(result, DARK_BG)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
	});

	it('leaves a too-dark accent unchanged on a light background (already safe)', () => {
		expect(safeTextColor('#0a1128', LIGHT_BG)).toBe('#0a1128');
	});

	it('leaves a too-light accent unchanged on a dark background (already safe)', () => {
		expect(safeTextColor('#fdf6e3', DARK_BG)).toBe('#fdf6e3');
	});
});
