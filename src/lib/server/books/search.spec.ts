import { describe, expect, it } from 'vitest';
import { sanitizeDescription } from './search';

describe('sanitizeDescription', () => {
	it('returns null for null input', () => {
		expect(sanitizeDescription(null)).toBeNull();
	});

	it('leaves an ordinary synopsis untouched', () => {
		const description = 'A hobbit sets out on an unexpected journey with thirteen dwarves.';
		expect(sanitizeDescription(description)).toBe(description);
	});

	it('strips a markdown-link spam tag appended to a real synopsis', () => {
		const description =
			'The Hobbit is a tale of high adventure. [**PDF**](https://chesserresources.com/doc/the-hobbit)';
		expect(sanitizeDescription(description)).toBe('The Hobbit is a tale of high adventure.');
	});

	it('strips a bare spam URL with no markdown-link wrapper', () => {
		const description = 'A great read. Download free at https://spam-site.example/download now.';
		expect(sanitizeDescription(description)).toBe('A great read. Download free at  now.');
	});

	it('collapses leftover blank lines left behind after stripping a link', () => {
		const description =
			'First paragraph.\n\n[**PDF**](https://spam.example/x)\n\nSecond paragraph.';
		expect(sanitizeDescription(description)).toBe('First paragraph.\n\nSecond paragraph.');
	});

	it('returns null if stripping links empties the description entirely', () => {
		expect(sanitizeDescription('[**PDF**](https://spam.example/x)')).toBeNull();
	});
});
