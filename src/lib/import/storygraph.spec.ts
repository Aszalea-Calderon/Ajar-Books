import { describe, expect, it } from 'vitest';
import { looksLikeStoryGraph, mapStoryGraphRow } from './storygraph';

const STORYGRAPH_HEADERS = [
	'Title',
	'Authors',
	'Contributors',
	'ISBN/UID',
	'Format',
	'Read Status',
	'Date Added',
	'Last Date Read',
	'Dates Read',
	'Read Count',
	'Moods',
	'Pace',
	'Star Rating',
	'Review',
	'Tags'
];

function row(overrides: Partial<Record<string, string>> = {}): Record<string, string> {
	return {
		Title: 'The Fifth Season',
		Authors: 'N.K. Jemisin',
		'ISBN/UID': '9780316229296',
		Format: 'physical book',
		'Read Status': 'read',
		'Date Added': '2023-02-01',
		'Last Date Read': '2023-03-10',
		'Read Count': '1',
		Moods: 'dark, emotional',
		'Star Rating': '4.5',
		Review: 'Incredible.',
		Tags: 'fantasy, science fiction',
		...overrides
	};
}

describe('looksLikeStoryGraph', () => {
	it('recognizes a real StoryGraph header set', () => {
		expect(looksLikeStoryGraph(STORYGRAPH_HEADERS)).toBe(true);
	});

	it('rejects a Goodreads-shaped header set', () => {
		expect(looksLikeStoryGraph(['Book Id', 'Title', 'Exclusive Shelf'])).toBe(false);
	});
});

describe('mapStoryGraphRow', () => {
	it('maps a finished book with mood/tag split', () => {
		const result = mapStoryGraphRow(row());
		expect(result.title).toBe('The Fifth Season');
		expect(result.author).toBe('N.K. Jemisin');
		expect(result.status).toBe('finished');
		expect(result.rating).toBe(4.5);
		expect(result.format).toBe('physical');
		expect(result.genres).toEqual(['Fantasy', 'Science Fiction']);
		expect(result.moods).toEqual(['Dark', 'Emotional']);
		expect(result.note).toBe('Incredible.');
	});

	it('takes only the first author from a multi-author list', () => {
		const result = mapStoryGraphRow(row({ Authors: 'N.K. Jemisin, Someone Else' }));
		expect(result.author).toBe('N.K. Jemisin');
	});

	it('maps every read status to the right internal status', () => {
		expect(mapStoryGraphRow(row({ 'Read Status': 'currently-reading' })).status).toBe('reading');
		expect(mapStoryGraphRow(row({ 'Read Status': 'to-read' })).status).toBe('want_to_read');
		expect(mapStoryGraphRow(row({ 'Read Status': 'did-not-finish' })).status).toBe('dnf');
	});

	it('maps ebook/audiobook formats', () => {
		expect(mapStoryGraphRow(row({ Format: 'ebook' })).format).toBe('ebook');
		expect(mapStoryGraphRow(row({ Format: 'audiobook' })).format).toBe('audiobook');
	});

	it('falls back gracefully when optional fields are blank', () => {
		const result = mapStoryGraphRow(
			row({ 'ISBN/UID': '', Format: '', 'Star Rating': '', Review: '', Moods: '', Tags: '' })
		);
		expect(result.isbn).toBeNull();
		expect(result.format).toBeNull();
		expect(result.rating).toBeNull();
		expect(result.note).toBeNull();
		expect(result.genres).toEqual([]);
		expect(result.moods).toEqual([]);
	});
});
