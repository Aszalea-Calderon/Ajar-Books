import { describe, expect, it } from 'vitest';
import { emptyGenericFieldMap, guessGenericFieldMap, mapGenericRow } from './generic';

describe('guessGenericFieldMap', () => {
	it('matches common column-name spellings case-insensitively', () => {
		const map = guessGenericFieldMap(['Title', 'Author', 'ISBN13', 'Page Count', 'My Rating']);
		expect(map.title).toBe('Title');
		expect(map.author).toBe('Author');
		expect(map.isbn).toBe('ISBN13');
		expect(map.pageCount).toBe('Page Count');
		expect(map.rating).toBe('My Rating');
	});

	it('leaves a field unmapped when nothing matches', () => {
		const map = guessGenericFieldMap(['Some Weird Column']);
		expect(map.title).toBeNull();
	});
});

describe('mapGenericRow', () => {
	it('maps only the columns the user pointed at', () => {
		const map = { ...emptyGenericFieldMap(), title: 'Book Title', author: 'By' };
		const result = mapGenericRow({ 'Book Title': 'Circe', By: 'Madeline Miller' }, map);
		expect(result.title).toBe('Circe');
		expect(result.author).toBe('Madeline Miller');
		expect(result.isbn).toBeNull();
	});

	it('applies the same defaultStatus to every row', () => {
		const map = { ...emptyGenericFieldMap(), title: 'Title', defaultStatus: 'finished' as const };
		const result = mapGenericRow({ Title: 'Circe' }, map);
		expect(result.status).toBe('finished');
	});

	it('splits a mapped genres column into title-cased tags', () => {
		const map = { ...emptyGenericFieldMap(), title: 'Title', genres: 'Shelf' };
		const result = mapGenericRow({ Title: 'Circe', Shelf: 'fantasy, mythology' }, map);
		expect(result.genres).toEqual(['Fantasy', 'Mythology']);
	});

	it('produces an empty title when the title column is unmapped', () => {
		const result = mapGenericRow({ Title: 'Circe' }, emptyGenericFieldMap());
		expect(result.title).toBe('');
	});
});
