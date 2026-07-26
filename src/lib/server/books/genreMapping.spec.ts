import { describe, expect, it } from 'vitest';
import { CANONICAL_GENRES, normalizeSubjectsToGenres } from './genreMapping';

describe('normalizeSubjectsToGenres', () => {
	it('maps real messy Open Library subjects to canonical genres', () => {
		// Actual subjects returned for N. K. Jemisin's "The Fifth Season" (OL17363125W)
		const subjects = [
			'LGBTQ novels',
			'LGBTQ science fiction & fantasy',
			'Fiction, fantasy, epic',
			'Mothers and daughters, fiction',
			'Fiction, dystopian',
			'Fiction, fantasy, general',
			'New York Times reviewed',
			'Hugo Award Winner',
			'End of the world',
			'Fiction',
			'Kidnapping',
			'Families'
		];

		expect(normalizeSubjectsToGenres(subjects).sort()).toEqual(
			['Fantasy', 'Science Fiction'].sort()
		);
	});

	it('maps a memoir/biography subject list to Memoir', () => {
		// Actual subjects for Tara Westover's "Educated" (OL18139176W) trimmed to the relevant ones
		const subjects = ['Biography', 'Mormons', 'Educated persons', 'Family relationships'];

		expect(normalizeSubjectsToGenres(subjects)).toEqual(['Memoir']);
	});

	it('only falls back to the broad Fiction bucket when nothing specific matched', () => {
		expect(normalizeSubjectsToGenres(['Fiction', 'Fantasy fiction'])).toEqual(['Fantasy']);
	});

	it('falls back to Fiction when no specific genre matches', () => {
		expect(normalizeSubjectsToGenres(['Fiction', 'American fiction -- 21st century'])).toEqual([
			'Fiction'
		]);
	});

	it('falls back to Nonfiction when no specific genre matches and it is nonfiction', () => {
		expect(normalizeSubjectsToGenres(['Nonfiction', 'Essays'])).toEqual(['Nonfiction']);
	});

	it('does not false-positive "Science" (popular science) on "Science Fiction" subjects', () => {
		// "Science fiction" contains the substring "science" — the Science rule
		// must not also fire, or every sci-fi book would get double-tagged.
		expect(normalizeSubjectsToGenres(['Science fiction, American'])).toEqual(['Science Fiction']);
	});

	it('matches "Science" only for actual popular-science subjects', () => {
		expect(normalizeSubjectsToGenres(['Popular science', 'Physics'])).toEqual(['Science']);
	});

	it('is case-insensitive', () => {
		expect(normalizeSubjectsToGenres(['FANTASY FICTION'])).toEqual(['Fantasy']);
	});

	it('returns an empty array for an empty subject list', () => {
		expect(normalizeSubjectsToGenres([])).toEqual([]);
	});

	it('returns an empty array when nothing matches at all', () => {
		expect(normalizeSubjectsToGenres(['Ephemera', 'Accessible book'])).toEqual([]);
	});

	it('can match multiple distinct specific genres from one subject list', () => {
		const genres = normalizeSubjectsToGenres(['Historical fiction', 'Mystery fiction']);
		expect(genres.sort()).toEqual(['Historical Fiction', 'Mystery'].sort());
	});

	it('never returns duplicate genres even if multiple keywords for the same genre match', () => {
		expect(normalizeSubjectsToGenres(['Detective fiction', 'Mystery', 'Crime fiction'])).toEqual([
			'Mystery'
		]);
	});
});

describe('CANONICAL_GENRES', () => {
	it('contains no duplicates', () => {
		expect(new Set(CANONICAL_GENRES).size).toBe(CANONICAL_GENRES.length);
	});

	it('includes the broad fallback genres alongside the specific ones', () => {
		expect(CANONICAL_GENRES).toContain('Fiction');
		expect(CANONICAL_GENRES).toContain('Nonfiction');
		expect(CANONICAL_GENRES).toContain('Fantasy');
	});
});
