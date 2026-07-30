import type { ImportRow, ImportStatus, ImportFormat } from './types';
import {
	cleanText,
	cleanIsbn,
	parseIntOrNull,
	parseRatingOrNull,
	parseDateOrNull,
	splitList,
	titleCase
} from './parseHelpers';

// A handful of headers only a genuine Goodreads export has — "Exclusive
// Shelf" and "Book Id" together are distinctive enough that requiring both
// avoids a false-positive match against some other platform's CSV.
const GOODREADS_FINGERPRINT = ['Book Id', 'Exclusive Shelf'];

export function looksLikeGoodreads(headers: string[]): boolean {
	const set = new Set(headers.map((h) => h.trim()));
	return GOODREADS_FINGERPRINT.every((h) => set.has(h));
}

const EXCLUSIVE_SHELF_STATUS: Record<string, ImportStatus> = {
	read: 'finished',
	'currently-reading': 'reading',
	'to-read': 'want_to_read'
};

// Goodreads has no built-in "did not finish" shelf — some readers make
// their own custom shelf for it, so a bookshelf literally named one of
// these overrides the exclusive-shelf-derived status.
const DNF_SHELF_NAMES = new Set(['dnf', 'did-not-finish', 'did not finish', 'abandoned']);

const BINDING_FORMAT: { pattern: RegExp; format: ImportFormat }[] = [
	{ pattern: /kindle|ebook|e-book/i, format: 'ebook' },
	{ pattern: /audio/i, format: 'audiobook' },
	{ pattern: /hardcover|paperback|mass market|board book|library binding/i, format: 'physical' }
];

function mapBinding(binding: string | null): ImportFormat | null {
	if (!binding) return null;
	const match = BINDING_FORMAT.find(({ pattern }) => pattern.test(binding));
	return match?.format ?? null;
}

export function mapGoodreadsRow(row: Record<string, string>): ImportRow {
	const title = cleanText(row['Title']) ?? '';
	const exclusiveShelf = cleanText(row['Exclusive Shelf'])?.toLowerCase() ?? null;
	const bookshelves = splitList(row['Bookshelves']);
	const bookshelvesLower = bookshelves.map((s) => s.toLowerCase());

	const isDnf = bookshelvesLower.some((shelf) => DNF_SHELF_NAMES.has(shelf));
	const status = isDnf ? 'dnf' : (exclusiveShelf && EXCLUSIVE_SHELF_STATUS[exclusiveShelf]) || null;

	// Bookshelves duplicates the exclusive shelf name alongside any custom
	// shelves — only the custom ones read as genre tags.
	const genreShelfNames = new Set(['read', 'currently-reading', 'to-read', ...DNF_SHELF_NAMES]);
	const genres = bookshelves
		.filter((shelf) => !genreShelfNames.has(shelf.toLowerCase()))
		.map(titleCase);

	const originalYear = parseIntOrNull(row['Original Publication Year']);
	const publishedYear = parseIntOrNull(row['Year Published']);

	return {
		title,
		author: cleanText(row['Author']),
		isbn: cleanIsbn(row['ISBN13']) ?? cleanIsbn(row['ISBN']),
		pageCount: parseIntOrNull(row['Number of Pages']),
		publicationYear: originalYear ?? publishedYear,
		status,
		rating: parseRatingOrNull(row['My Rating']),
		format: mapBinding(cleanText(row['Binding'])),
		finishedAt: parseDateOrNull(row['Date Read']),
		dateAdded: parseDateOrNull(row['Date Added']),
		timesFinished: status === 'finished' ? (parseIntOrNull(row['Read Count']) ?? 1) : null,
		genres,
		moods: [],
		note: cleanText(row['My Review'])
	};
}
