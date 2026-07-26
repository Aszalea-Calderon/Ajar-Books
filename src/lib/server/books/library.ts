import { db } from '$lib/server/db';
import { books, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import { eq, inArray, ne, or } from 'drizzle-orm';
import { getOpenLibraryWorkDetails, sanitizeDescription, type BookSearchResult } from './search';
import { normalizeSubjectsToGenres } from './genreMapping';
import { applyGenreSuggestions, type TagType } from './tags';

/**
 * Finds-or-creates the Book row for a search result, then finds-or-creates
 * its UserBook (single-user app: a Book maps to at most one UserBook).
 */
export async function addBookToLibrary(result: BookSearchResult) {
	const matchConditions = [
		result.openLibraryId ? eq(books.openLibraryId, result.openLibraryId) : undefined,
		result.isbn ? eq(books.isbn, result.isbn) : undefined
	].filter((c) => c !== undefined);

	const [existingBook] = matchConditions.length
		? await db
				.select()
				.from(books)
				.where(or(...matchConditions))
		: [];

	// Fetched once, before creating the book, so the description can be part
	// of the initial insert. Only for a genuinely new book — best-effort, see
	// getOpenLibraryWorkDetails.
	let description = result.description;
	let genresToApply: string[] = [];

	if (!existingBook && result.openLibraryId) {
		const details = await getOpenLibraryWorkDetails(result.openLibraryId);
		description = description ?? details.description;
		genresToApply = normalizeSubjectsToGenres(details.subjects);
	}

	const book =
		existingBook ??
		(
			await db
				.insert(books)
				.values({
					title: result.title,
					author: result.author,
					coverUrl: result.coverUrl,
					openLibraryId: result.openLibraryId,
					isbn: result.isbn,
					description: sanitizeDescription(description),
					pageCount: result.pageCount,
					publicationYear: result.publicationYear
				})
				.returning()
		)[0];

	const [existingUserBook] = await db.select().from(userBooks).where(eq(userBooks.bookId, book.id));

	if (existingUserBook) {
		return { bookId: book.id, userBookId: existingUserBook.id, alreadyInLibrary: true };
	}

	const [userBook] = await db.insert(userBooks).values({ bookId: book.id }).returning();

	if (genresToApply.length > 0) {
		await applyGenreSuggestions(userBook.id, genresToApply);
	}

	return { bookId: book.id, userBookId: userBook.id, alreadyInLibrary: false };
}

export type LibraryBook = {
	book: typeof books.$inferSelect;
	userBook: typeof userBooks.$inferSelect;
	tags: Record<TagType, string[]>;
};

/**
 * Every book that's had a status deliberately chosen — excludes 'added',
 * the transient just-added-nothing-decided-yet marker (see the schema
 * comment on userBooks.status), since it isn't a real shelf to browse.
 */
export async function getLibraryBooks(): Promise<LibraryBook[]> {
	const rows = await db
		.select({ book: books, userBook: userBooks })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(ne(userBooks.status, 'added'));

	if (rows.length === 0) return [];

	const userBookIds = rows.map((r) => r.userBook.id);
	const tagRows = await db
		.select({ userBookId: userBookTags.userBookId, type: tags.type, name: tags.name })
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(inArray(userBookTags.userBookId, userBookIds));

	const tagsByUserBook = new Map<string, Record<TagType, string[]>>();
	for (const row of tagRows) {
		const entry = tagsByUserBook.get(row.userBookId) ?? { genre: [], mood: [], setting: [] };
		entry[row.type].push(row.name);
		tagsByUserBook.set(row.userBookId, entry);
	}

	return rows.map((row) => ({
		...row,
		tags: tagsByUserBook.get(row.userBook.id) ?? { genre: [], mood: [], setting: [] }
	}));
}

/**
 * Every distinct tag name in use, per type — powers the Profile library
 * filter dropdowns without needing the full curated genre list mixed in
 * (unlike getSuggestedTagNames, which is for autocomplete when adding one).
 */
export async function getUsedTagNames(type: TagType): Promise<string[]> {
	const rows = await db
		.selectDistinct({ name: tags.name })
		.from(tags)
		.innerJoin(userBookTags, eq(userBookTags.tagId, tags.id))
		.where(eq(tags.type, type));
	return rows.map((r) => r.name).sort();
}
