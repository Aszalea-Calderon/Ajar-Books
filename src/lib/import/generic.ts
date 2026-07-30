import type { ImportRow, ImportStatus } from './types';
import {
	cleanText,
	cleanIsbn,
	parseIntOrNull,
	parseRatingOrNull,
	splitList,
	titleCase
} from './parseHelpers';

/**
 * Fallback for anything that isn't recognized as Goodreads or StoryGraph —
 * the user manually points each of our fields at one of their CSV's
 * columns. There's no way to know an unrecognized platform's status/shelf
 * vocabulary, so every row in a generic import gets the same status rather
 * than guessing at per-row status text.
 */
export type GenericFieldMap = {
	title: string | null;
	author: string | null;
	isbn: string | null;
	pageCount: string | null;
	publicationYear: string | null;
	rating: string | null;
	genres: string | null;
	defaultStatus: ImportStatus;
};

export function emptyGenericFieldMap(): GenericFieldMap {
	return {
		title: null,
		author: null,
		isbn: null,
		pageCount: null,
		publicationYear: null,
		rating: null,
		genres: null,
		defaultStatus: 'want_to_read'
	};
}

// Best-effort auto-guess so the mapping step isn't blank by default —
// matches a handful of very common column-name spellings, case-insensitively.
const GUESS_PATTERNS: Record<keyof Omit<GenericFieldMap, 'defaultStatus'>, RegExp> = {
	title: /^title$/i,
	author: /^authors?$/i,
	isbn: /^isbn(13)?([/-]?uid)?$/i,
	pageCount: /^(number of )?pages?( count)?$/i,
	publicationYear: /^(original )?(publication|published) ?year$/i,
	rating: /rating/i,
	genres: /^(genre|tags?|shelves|bookshelves)$/i
};

export function guessGenericFieldMap(headers: string[]): GenericFieldMap {
	const map = emptyGenericFieldMap();
	for (const [field, pattern] of Object.entries(GUESS_PATTERNS)) {
		const match = headers.find((h) => pattern.test(h.trim()));
		if (match) map[field as keyof typeof GUESS_PATTERNS] = match;
	}
	return map;
}

export function mapGenericRow(row: Record<string, string>, map: GenericFieldMap): ImportRow {
	return {
		title: (map.title ? cleanText(row[map.title]) : null) ?? '',
		author: map.author ? cleanText(row[map.author]) : null,
		isbn: map.isbn ? cleanIsbn(row[map.isbn]) : null,
		pageCount: map.pageCount ? parseIntOrNull(row[map.pageCount]) : null,
		publicationYear: map.publicationYear ? parseIntOrNull(row[map.publicationYear]) : null,
		status: map.defaultStatus,
		rating: map.rating ? parseRatingOrNull(row[map.rating]) : null,
		format: null,
		finishedAt: null,
		dateAdded: null,
		timesFinished: null,
		genres: map.genres ? splitList(row[map.genres]).map(titleCase) : [],
		moods: [],
		note: null
	};
}
