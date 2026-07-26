import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { getProgressTotals, logProgress } from '$lib/server/books/progress';

async function loadBookAndUserBook(bookId: string) {
	const [book] = await db.select().from(books).where(eq(books.id, bookId));
	if (!book) return null;

	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.bookId, bookId));
	if (!userBook) return null;

	return { book, userBook };
}

export const load: PageServerLoad = async ({ params }) => {
	const result = await loadBookAndUserBook(params.id);
	if (!result) error(404, 'Book not found');

	const { book, userBook } = result;

	const logs = await db
		.select()
		.from(readingLogs)
		.where(eq(readingLogs.userBookId, userBook.id))
		.orderBy(desc(readingLogs.loggedAt));

	const totals = await getProgressTotals(userBook.id);

	return { book, userBook, logs, totals };
};

export const actions: Actions = {
	setFormat: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const format = String(data.get('format') ?? '');
		if (!['physical', 'ebook', 'audiobook'].includes(format)) {
			return fail(400, { error: 'Invalid format' });
		}

		const totalPagesRaw = data.get('totalPages');
		const totalMinutesRaw = data.get('totalMinutes');

		await db
			.update(userBooks)
			.set({
				format: format as 'physical' | 'ebook' | 'audiobook',
				totalPages: totalPagesRaw ? Number(totalPagesRaw) : null,
				totalMinutes: totalMinutesRaw ? Number(totalMinutesRaw) : null
			})
			.where(eq(userBooks.id, result.userBook.id));
	},

	logProgress: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const pagesRaw = data.get('pagesRead');
		const minutesRaw = data.get('minutesRead');
		const note = String(data.get('note') ?? '').trim();

		const pagesRead = pagesRaw ? Number(pagesRaw) : undefined;
		const minutesRead = minutesRaw ? Number(minutesRaw) : undefined;

		if (!pagesRead && !minutesRead) {
			return fail(400, { error: 'Enter an amount read' });
		}

		await logProgress({
			userBookId: result.userBook.id,
			pagesRead,
			minutesRead,
			note: note || undefined
		});
	},

	delete: async ({ params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		// Deleting the book cascades to its UserBook and ReadingLog rows
		// (enforced via the foreign_keys pragma set on the db connection).
		await db.delete(books).where(eq(books.id, result.book.id));

		throw redirect(303, '/');
	}
};
