import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, userBooks, readingLogs } from '$lib/server/db/schema';
import { addBookToLibrary } from '$lib/server/books/library';
import { addTag } from '$lib/server/books/tags';
import type { ImportRow } from '$lib/import/types';

export type ImportRowOutcome = 'added' | 'merged' | 'error';
export type ImportRowResult = { title: string; outcome: ImportRowOutcome; message?: string };

/**
 * Imported rows usually only have an ISBN (no Open Library id), and a
 * meaningful chunk of real exports have neither — older/out-of-print
 * editions, some ebooks. addBookToLibrary's own dedupe only matches on
 * openLibraryId/isbn, so without this fallback, re-running an import (or a
 * export with a book listed twice) would silently create duplicate Book
 * rows for anything lacking an ISBN. Falls back to a case-insensitive
 * title+author match only when there's no ISBN to match on instead.
 */
async function resolveTarget(row: ImportRow) {
	if (!row.isbn) {
		const candidates = await db
			.select()
			.from(books)
			.where(sql`lower(${books.title}) = lower(${row.title})`);
		const existingBook = row.author
			? (candidates.find((b) => b.author?.toLowerCase() === row.author!.toLowerCase()) ?? null)
			: (candidates[0] ?? null);

		if (existingBook) {
			const [existingUserBook] = await db
				.select()
				.from(userBooks)
				.where(eq(userBooks.bookId, existingBook.id));

			if (existingUserBook) {
				return { bookId: existingBook.id, userBookId: existingUserBook.id, alreadyInLibrary: true };
			}

			const [newUserBook] = await db
				.insert(userBooks)
				.values({ bookId: existingBook.id })
				.returning();
			return { bookId: existingBook.id, userBookId: newUserBook.id, alreadyInLibrary: false };
		}
	}

	// Genres are applied uniformly below regardless of which path resolved
	// the book, so this always passes an empty list rather than duplicating
	// that logic here too.
	return addBookToLibrary({
		title: row.title,
		author: row.author,
		coverUrl: null,
		openLibraryId: null,
		isbn: row.isbn,
		description: null,
		pageCount: row.pageCount,
		publicationYear: row.publicationYear,
		genres: []
	});
}

export async function applyImportRow(row: ImportRow): Promise<ImportRowResult> {
	const title = row.title.trim();
	if (!title) return { title: '(untitled)', outcome: 'error', message: 'Missing title' };

	try {
		const { userBookId, alreadyInLibrary } = await resolveTarget({ ...row, title });

		const updates: Record<string, unknown> = {};
		if (row.status) updates.status = row.status;
		if (row.rating != null) updates.rating = row.rating;
		if (row.format) updates.format = row.format;
		if (row.finishedAt) updates.finishedAt = new Date(row.finishedAt);
		if (row.status === 'finished') updates.timesFinished = row.timesFinished ?? 1;
		if (row.dateAdded) updates.createdAt = new Date(row.dateAdded);

		if (Object.keys(updates).length > 0) {
			await db.update(userBooks).set(updates).where(eq(userBooks.id, userBookId));
		}

		for (const genre of row.genres) await addTag(userBookId, 'genre', genre);
		for (const mood of row.moods) await addTag(userBookId, 'mood', mood);

		if (row.note) {
			await db.insert(readingLogs).values({
				userBookId,
				note: row.note,
				loggedAt: row.finishedAt
					? new Date(row.finishedAt)
					: row.dateAdded
						? new Date(row.dateAdded)
						: new Date()
			});
		}

		return { title, outcome: alreadyInLibrary ? 'merged' : 'added' };
	} catch (err) {
		return {
			title,
			outcome: 'error',
			message: err instanceof Error ? err.message : 'Unknown error'
		};
	}
}
