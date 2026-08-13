import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import type { ImportRow } from '$lib/import/types';

/**
 * Read-only preview of applyImportRow's own matching rule (ISBN, else
 * title+author when there's no ISBN — see resolveTarget in
 * applyImportRow.ts) so the import preview step can show which rows will
 * merge into a book already in the library rather than only finding out
 * from the results summary after committing. Never writes anything.
 * "In the library" specifically means a real userBooks row, not just a
 * same-titled Book existing from some earlier metadata lookup.
 */
export async function checkAlreadyInLibrary(
	rows: Pick<ImportRow, 'title' | 'author' | 'isbn'>[]
): Promise<boolean[]> {
	const libraryBooks = await db
		.select({ isbn: books.isbn, title: books.title, author: books.author })
		.from(books)
		.innerJoin(userBooks, eq(userBooks.bookId, books.id));

	return rows.map((row) => {
		if (row.isbn) return libraryBooks.some((b) => b.isbn === row.isbn);
		const titleLower = row.title.trim().toLowerCase();
		return libraryBooks.some(
			(b) =>
				b.title.toLowerCase() === titleLower &&
				(!row.author || b.author?.toLowerCase() === row.author.toLowerCase())
		);
	});
}
