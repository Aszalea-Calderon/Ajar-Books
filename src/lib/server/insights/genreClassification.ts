import { CANONICAL_GENRES } from '$lib/server/books/genreMapping';

/**
 * Fiction/nonfiction is a judgment call for genres that are really a form or
 * audience, not a fiction/nonfiction signal (Poetry, Young Adult, Graphic
 * Novel, Classics) — bucketed here by what's most common in practice, not
 * derived from anything structural. Revisit if it reads wrong against a real
 * library.
 */
const NONFICTION_GENRES = new Set(['Nonfiction', 'Memoir', 'History', 'Self-Help', 'Business', 'Science']);

const FICTION_GENRES = new Set(
	CANONICAL_GENRES.filter((genre) => !NONFICTION_GENRES.has(genre))
);

export type FictionCategory = 'fiction' | 'nonfiction' | 'unclassified';

/**
 * A book with any fiction-leaning genre tag counts as fiction even if it
 * also carries a nonfiction-leaning one (e.g. "Historical Fiction" +
 * "History") — the more specific genre tends to be the more accurate one.
 * Only falls to nonfiction when every tag is nonfiction-leaning, and to
 * unclassified when there's no genre tag to go on at all.
 */
export function classifyFiction(genreTags: string[]): FictionCategory {
	if (genreTags.length === 0) return 'unclassified';
	if (genreTags.some((genre) => FICTION_GENRES.has(genre))) return 'fiction';
	if (genreTags.some((genre) => NONFICTION_GENRES.has(genre))) return 'nonfiction';
	return 'unclassified';
}
