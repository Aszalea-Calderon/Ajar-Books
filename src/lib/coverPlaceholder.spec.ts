import { describe, expect, it } from 'vitest';
import { coverSrc, placeholderCoverDataUri } from './coverPlaceholder';

describe('coverSrc', () => {
	it('passes through a real cover URL unchanged', () => {
		expect(coverSrc('https://covers.example/dune.jpg', 'dune-id', 'Dune')).toBe(
			'https://covers.example/dune.jpg'
		);
	});

	it('falls back to a generated placeholder when there is no cover URL', () => {
		const src = coverSrc(null, 'dune-id', 'Dune');
		expect(src.startsWith('data:image/svg+xml,')).toBe(true);
	});
});

describe('placeholderCoverDataUri', () => {
	it('is deterministic for the same seed', () => {
		expect(placeholderCoverDataUri('same-seed', 'Dune')).toBe(
			placeholderCoverDataUri('same-seed', 'Dune')
		);
	});

	it('varies the palette across different seeds', () => {
		// Not every pair of seeds is guaranteed to land on different palette
		// slots, but a spread of seeds should hit more than one color —
		// this is the actual "doesn't look monotonous" property that matters.
		const uris = Array.from({ length: 20 }, (_, i) => placeholderCoverDataUri(`seed-${i}`, 'Book'));
		const colors = new Set(uris.map((uri) => decodeURIComponent(uri).match(/fill="(#[0-9A-F]{6})"/)?.[1]));
		expect(colors.size).toBeGreaterThan(1);
	});

	it('escapes XML-sensitive characters in the title', () => {
		const svg = decodeURIComponent(placeholderCoverDataUri('seed', 'Cats & Dogs <3'));
		expect(svg).not.toContain('& Dogs <3');
		expect(svg).toContain('&amp;');
		expect(svg).toContain('&lt;');
	});

	it('renders with no title text at all when none is given', () => {
		const svg = decodeURIComponent(placeholderCoverDataUri('seed'));
		expect(svg).not.toContain('<text');
	});

	it('wraps and caps long titles instead of overflowing the cover', () => {
		const longTitle =
			'The Extraordinarily Long and Winding Title of a Book That Definitely Will Not Fit on One Line';
		const svg = decodeURIComponent(placeholderCoverDataUri('seed', longTitle));
		const lineCount = (svg.match(/<text/g) ?? []).length;
		expect(lineCount).toBeGreaterThan(0);
		expect(lineCount).toBeLessThanOrEqual(5);
	});

	it('produces a parseable data URI', () => {
		const uri = placeholderCoverDataUri('seed', 'Dune');
		expect(uri).toMatch(/^data:image\/svg\+xml,/);
		const svg = decodeURIComponent(uri.slice('data:image/svg+xml,'.length));
		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg.endsWith('</svg>')).toBe(true);
	});
});
