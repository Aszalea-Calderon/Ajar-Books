import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpenLibraryWorkDetails, sanitizeDescription } from './search';

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

	it('strips a reference-style link and its separate definition line', () => {
		const description =
			'Circe is a triumph of storytelling. ([source][1])\n\n[1]: https://chesserresources.com/doc/circe';
		expect(sanitizeDescription(description)).toBe('Circe is a triumph of storytelling.');
	});

	it('strips a reference-style link with no surrounding parentheses', () => {
		const description = 'A great read [source][1] by all accounts.\n\n[1]: https://spam.example/x';
		expect(sanitizeDescription(description)).toBe('A great read  by all accounts.');
	});
});

describe('getOpenLibraryWorkDetails', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('rejects a path-traversal id without making a network request', async () => {
		const fetchSpy = vi.spyOn(global, 'fetch');
		const result = await getOpenLibraryWorkDetails('/works/OL123W/../../evil');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(result).toEqual({ subjects: [], description: null });
	});

	it('rejects an id that is actually an absolute URL to another host', async () => {
		const fetchSpy = vi.spyOn(global, 'fetch');
		const result = await getOpenLibraryWorkDetails('https://evil.example/works/OL123W');
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(result).toEqual({ subjects: [], description: null });
	});

	it('accepts a well-formed work id and fetches it', async () => {
		const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ subjects: ['Fantasy'], description: 'A tale.' })
		} as Response);

		const result = await getOpenLibraryWorkDetails('/works/OL123W');

		expect(fetchSpy).toHaveBeenCalledWith('https://openlibrary.org/works/OL123W.json');
		expect(result).toEqual({ subjects: ['Fantasy'], description: 'A tale.' });
	});
});
