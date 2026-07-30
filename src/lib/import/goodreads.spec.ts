import { describe, expect, it } from 'vitest';
import { looksLikeGoodreads, mapGoodreadsRow } from './goodreads';

const GOODREADS_HEADERS = [
	'Book Id',
	'Title',
	'Author',
	'ISBN',
	'ISBN13',
	'My Rating',
	'Average Rating',
	'Publisher',
	'Binding',
	'Number of Pages',
	'Year Published',
	'Original Publication Year',
	'Date Read',
	'Date Added',
	'Bookshelves',
	'Bookshelves with positions',
	'Exclusive Shelf',
	'My Review',
	'Read Count'
];

function row(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
	return {
		'Book Id': '12345',
		Title: 'Dune',
		Author: 'Frank Herbert',
		ISBN: '="0441013597"',
		ISBN13: '="9780441013593"',
		'My Rating': '5',
		Binding: 'Paperback',
		'Number of Pages': '412',
		'Year Published': '1990',
		'Original Publication Year': '1965',
		'Date Read': '2023/06/15',
		'Date Added': '2023/01/02',
		Bookshelves: 'read, sci-fi, favorites',
		'Exclusive Shelf': 'read',
		'My Review': 'Loved it.',
		'Read Count': '2',
		...overrides
	};
}

describe('looksLikeGoodreads', () => {
	it('recognizes a real Goodreads header set', () => {
		expect(looksLikeGoodreads(GOODREADS_HEADERS)).toBe(true);
	});

	it('rejects an unrelated header set', () => {
		expect(looksLikeGoodreads(['Title', 'Author', 'Read Status', 'Moods'])).toBe(false);
	});
});

describe('mapGoodreadsRow', () => {
	it('maps a finished book with a rating, dates, and shelves', () => {
		const result = mapGoodreadsRow(row());
		expect(result.title).toBe('Dune');
		expect(result.author).toBe('Frank Herbert');
		expect(result.status).toBe('finished');
		expect(result.rating).toBe(5);
		expect(result.timesFinished).toBe(2);
		expect(result.format).toBe('physical');
		expect(result.publicationYear).toBe(1965);
		expect(result.pageCount).toBe(412);
		expect(result.note).toBe('Loved it.');
	});

	it('strips the ="..." wrapper Goodreads puts around ISBN columns', () => {
		const result = mapGoodreadsRow(row());
		expect(result.isbn).toBe('9780441013593');
	});

	it('excludes the exclusive shelf name from genre tags but keeps custom shelves', () => {
		const result = mapGoodreadsRow(row());
		expect(result.genres).toEqual(['Sci Fi', 'Favorites']);
	});

	it('maps "currently-reading" and "to-read" shelves to the right status', () => {
		expect(mapGoodreadsRow(row({ 'Exclusive Shelf': 'currently-reading' })).status).toBe('reading');
		expect(mapGoodreadsRow(row({ 'Exclusive Shelf': 'to-read' })).status).toBe('want_to_read');
	});

	it('treats a custom "dnf" shelf as an override to Did Not Finish', () => {
		const result = mapGoodreadsRow(row({ 'Exclusive Shelf': 'read', Bookshelves: 'read, dnf' }));
		expect(result.status).toBe('dnf');
	});

	it('treats an unrated book (My Rating: 0) as no rating', () => {
		expect(mapGoodreadsRow(row({ 'My Rating': '0' })).rating).toBeNull();
	});

	it('only sets timesFinished for a finished book', () => {
		expect(mapGoodreadsRow(row({ 'Exclusive Shelf': 'to-read' })).timesFinished).toBeNull();
	});

	it('falls back gracefully when optional fields are blank', () => {
		const result = mapGoodreadsRow(
			row({
				ISBN: '',
				ISBN13: '',
				'My Rating': '',
				Binding: '',
				'Date Read': '',
				'My Review': ''
			})
		);
		expect(result.isbn).toBeNull();
		expect(result.rating).toBeNull();
		expect(result.format).toBeNull();
		expect(result.finishedAt).toBeNull();
		expect(result.note).toBeNull();
	});
});
