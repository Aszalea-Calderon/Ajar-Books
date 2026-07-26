import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import {
	editProgress,
	getProgressTotals,
	logProgress,
	resetUserBook,
	setStatus,
	type BookStatus
} from '$lib/server/books/progress';
import {
	addTag,
	getSuggestedTagNames,
	getTagsForUserBook,
	removeTag,
	type TagType
} from '$lib/server/books/tags';

const TAG_TYPES: TagType[] = ['genre', 'mood', 'setting'];

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

	const tagsByType = Object.fromEntries(
		await Promise.all(
			TAG_TYPES.map(async (type) => [type, await getTagsForUserBook(userBook.id, type)] as const)
		)
	) as Record<TagType, { id: string; name: string }[]>;

	const suggestionsByType = Object.fromEntries(
		await Promise.all(
			TAG_TYPES.map(async (type) => [type, await getSuggestedTagNames(type)] as const)
		)
	) as Record<TagType, string[]>;

	return { book, userBook, logs, totals, tagsByType, suggestionsByType };
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

	// "Start Reading": the one action that begins tracking. Unlike setFormat
	// above (used later to change format on an already-reading book), this
	// always jumps status straight to 'reading' — from 'added', 'want_to_read',
	// or anywhere else — and takes an explicit start date rather than always
	// stamping "now", since you might be logging a book you started a few
	// days ago.
	startReading: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const format = String(data.get('format') ?? '');
		if (!['physical', 'ebook', 'audiobook'].includes(format)) {
			return fail(400, { error: 'Invalid format' });
		}

		const totalPagesRaw = data.get('totalPages');
		const totalMinutesRaw = data.get('totalMinutes');
		const startedAtRaw = String(data.get('startedAt') ?? '');
		const startedAt =
			startedAtRaw && !Number.isNaN(Date.parse(startedAtRaw)) ? new Date(startedAtRaw) : new Date();

		await db
			.update(userBooks)
			.set({
				format: format as 'physical' | 'ebook' | 'audiobook',
				totalPages: totalPagesRaw ? Number(totalPagesRaw) : null,
				totalMinutes: totalMinutesRaw ? Number(totalMinutesRaw) : null,
				status: 'reading',
				startedAt
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

	editProgress: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const logId = String(data.get('logId') ?? '');
		const pagesRaw = data.get('pagesRead');
		const minutesRaw = data.get('minutesRead');
		const note = String(data.get('note') ?? '').trim();

		const pagesRead = pagesRaw ? Number(pagesRaw) : undefined;
		const minutesRead = minutesRaw ? Number(minutesRaw) : undefined;

		if (!logId || (!pagesRead && !minutesRead)) {
			return fail(400, { error: 'Enter an amount read' });
		}

		await editProgress({ logId, pagesRead, minutesRead, note: note || undefined });
	},

	setStatus: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		const validStatuses: BookStatus[] = ['want_to_read', 'reading', 'finished', 'dnf'];
		if (!validStatuses.includes(status as BookStatus)) {
			return fail(400, { error: 'Invalid status' });
		}

		await setStatus(result.userBook.id, status as BookStatus);
	},

	removeBook: async ({ params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		await resetUserBook(result.userBook.id);
	},

	setRating: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const rating = Number(data.get('rating'));

		await db
			.update(userBooks)
			.set({ rating: Number.isFinite(rating) ? rating : null })
			.where(eq(userBooks.id, result.userBook.id));
	},

	// Follow-up prompt shown right after a book transitions to "Finished"
	// (whether that happened automatically by crossing the reading goal, or
	// manually via the status control) — lets you set a rating and correct
	// the finish date, since it might not have actually been "just now".
	confirmFinished: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const ratingRaw = data.get('rating');
		const finishedAtRaw = String(data.get('finishedAt') ?? '');

		const rating = ratingRaw ? Number(ratingRaw) : null;
		const finishedAt =
			finishedAtRaw && !Number.isNaN(Date.parse(finishedAtRaw))
				? new Date(finishedAtRaw)
				: new Date();

		await db
			.update(userBooks)
			.set({
				rating: rating != null && Number.isFinite(rating) ? rating : null,
				finishedAt
			})
			.where(eq(userBooks.id, result.userBook.id));
	},

	addTag: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const type = String(data.get('type') ?? '');
		const name = String(data.get('name') ?? '');

		if (!TAG_TYPES.includes(type as TagType) || !name.trim()) return;

		await addTag(result.userBook.id, type as TagType, name);
	},

	removeTag: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const tagId = String(data.get('tagId') ?? '');
		if (!tagId) return;

		await removeTag(result.userBook.id, tagId);
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
