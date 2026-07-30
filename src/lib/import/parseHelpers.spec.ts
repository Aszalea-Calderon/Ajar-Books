import { describe, expect, it } from 'vitest';
import { stripHtml } from './parseHelpers';

describe('stripHtml', () => {
	it('returns null for null/empty input', () => {
		expect(stripHtml(null)).toBeNull();
		expect(stripHtml('')).toBeNull();
	});

	it('strips a simple wrapping tag and decodes &nbsp;', () => {
		expect(stripHtml('<div>Loved every page.&nbsp;</div>')).toBe('Loved every page.');
	});

	it('turns <br> and closing block tags into line breaks', () => {
		expect(stripHtml('<div>Line one<br>Line two</div>')).toBe('Line one\nLine two');
	});

	it('converts a <ul><li> list into newline-separated plain text', () => {
		expect(stripHtml('<ul><li>First point</li><li>Second point</li></ul>')).toBe(
			'First point\nSecond point'
		);
	});

	it('decodes real HTML tags but leaves an escaped &lt;spoiler&gt; convention as visible text', () => {
		expect(stripHtml('<div>Setup. &lt;spoiler&gt;The twist.&lt;/spoiler&gt;</div>')).toBe(
			'Setup. <spoiler>The twist.</spoiler>'
		);
	});

	it('collapses repeated blank lines', () => {
		expect(stripHtml('<div>One</div><div></div><div>Two</div>')).toBe('One\n\nTwo');
	});
});
