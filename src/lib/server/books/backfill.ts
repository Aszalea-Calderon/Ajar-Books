import { db } from '$lib/server/db';
import { books, tags, userBooks, userBookTags } from '$lib/server/db/schema';
import { eq, inArray, isNull, or } from 'drizzle-orm';
import { getOpenLibraryDetailsByIsbn, getOpenLibraryWorkDetails, sanitizeDescription } from './search';
import { normalizeSubjectsToGenres } from './genreMapping';
import { applyGenreSuggestions } from './tags';

export type BackfillOutcome = {
	bookId: string;
	title: string;
	updated: Array<'cover' | 'description' | 'genre' | 'openLibraryId'>;
};

/**
 * Books missing a cover or description that we can still do something
 * about — an isbn or openLibraryId to look up. A book with neither (rare;
 * mainly hand-entered/no-match import rows) has no lookup path and isn't
 * included; nothing to backfill it from.
 */
async function findCandidateBooks() {
	const candidates = await db
		.select()
		.from(books)
		.where(or(isNull(books.coverUrl), isNull(books.description)));

	return candidates.filter((book) => book.isbn || book.openLibraryId);
}

/** Genre tag names already present per userBookId, for the "only fill in if empty" rule below. */
async function getExistingGenreCounts(userBookIds: string[]): Promise<Map<string, number>> {
	if (userBookIds.length === 0) return new Map();
	const rows = await db
		.select({ userBookId: userBookTags.userBookId, type: tags.type })
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(inArray(userBookTags.userBookId, userBookIds));

	const counts = new Map<string, number>();
	for (const row of rows) {
		if (row.type !== 'genre') continue;
		counts.set(row.userBookId, (counts.get(row.userBookId) ?? 0) + 1);
	}
	return counts;
}

/**
 * Backfills cover/description/genre for every library book that's missing
 * one and has an isbn or openLibraryId to look it up from — the one-time
 * catch-up for books added before addBookToLibrary's ISBN-lookup path
 * existed (mainly CSV imports, see applyImportRow.ts). Genre is only
 * applied when the book currently has none at all, so this never overrides
 * or duplicates tags you (or an import) already curated.
 *
 * Sequential, not parallel — Open Library is a shared third-party service
 * with no API key on this app's side; a burst of concurrent requests for a
 * few hundred books at once is a worse citizen than the same requests
 * spread out, even though each one is already best-effort/short-timeout.
 */
export async function backfillMissingMetadata(): Promise<BackfillOutcome[]> {
	const candidates = await findCandidateBooks();
	if (candidates.length === 0) return [];

	const bookIdToUserBook = new Map(
		(
			await db
				.select({ id: userBooks.id, bookId: userBooks.bookId })
				.from(userBooks)
				.where(
					inArray(
						userBooks.bookId,
						candidates.map((c) => c.id)
					)
				)
		).map((row) => [row.bookId, row.id])
	);
	const genreCounts = await getExistingGenreCounts([...bookIdToUserBook.values()]);

	const outcomes: BackfillOutcome[] = [];

	for (const book of candidates) {
		const updated: BackfillOutcome['updated'] = [];
		const userBookId = bookIdToUserBook.get(book.id);
		const hasGenre = userBookId ? (genreCounts.get(userBookId) ?? 0) > 0 : true;

		let subjects: string[] = [];
		let description: string | null = null;
		let coverUrl: string | null = null;
		let openLibraryId: string | null = null;

		if (book.openLibraryId) {
			const details = await getOpenLibraryWorkDetails(book.openLibraryId);
			subjects = details.subjects;
			description = details.description;
		} else if (book.isbn) {
			const details = await getOpenLibraryDetailsByIsbn(book.isbn);
			subjects = details.subjects;
			description = details.description;
			coverUrl = details.coverUrl;
			openLibraryId = details.openLibraryId;
		}

		const patch: Partial<typeof books.$inferInsert> = {};
		if (!book.coverUrl && coverUrl) {
			patch.coverUrl = coverUrl;
			updated.push('cover');
		}
		if (!book.description && description) {
			patch.description = sanitizeDescription(description);
			updated.push('description');
		}
		if (!book.openLibraryId && openLibraryId) {
			patch.openLibraryId = openLibraryId;
			updated.push('openLibraryId');
		}
		if (Object.keys(patch).length > 0) {
			await db.update(books).set(patch).where(eq(books.id, book.id));
		}

		if (!hasGenre && userBookId && subjects.length > 0) {
			const genres = normalizeSubjectsToGenres(subjects);
			if (genres.length > 0) {
				await applyGenreSuggestions(userBookId, genres);
				updated.push('genre');
			}
		}

		if (updated.length > 0) {
			outcomes.push({ bookId: book.id, title: book.title, updated });
		}
	}

	return outcomes;
}
