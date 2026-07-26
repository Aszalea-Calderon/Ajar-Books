import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';
import type { BookSearchResult } from './search';

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
					isbn: result.isbn
				})
				.returning()
		)[0];

	const [existingUserBook] = await db.select().from(userBooks).where(eq(userBooks.bookId, book.id));

	if (existingUserBook) {
		return { bookId: book.id, userBookId: existingUserBook.id, alreadyInLibrary: true };
	}

	const [userBook] = await db
		.insert(userBooks)
		.values({ bookId: book.id, status: 'want_to_read' })
		.returning();

	return { bookId: book.id, userBookId: userBook.id, alreadyInLibrary: false };
}
