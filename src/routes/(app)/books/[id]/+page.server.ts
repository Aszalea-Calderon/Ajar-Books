import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { parseLocalDateInput } from '$lib/date';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import {
	deleteLog,
	editProgress,
	getProgressTotals,
	logProgress,
	resetUserBook,
	setStatus,
	untoggleWantToRead,
	type BookStatus
} from '$lib/server/books/progress';
import { searchBooks } from '$lib/server/books/search';
import {
	addTag,
	getSuggestedTagNames,
	getTagsForUserBook,
	removeTag,
	type TagType
} from '$lib/server/books/tags';

const TAG_TYPES: TagType[] = ['genre', 'mood', 'setting'];
const MORE_BY_AUTHOR_LIMIT = 8;

/**
 * A handful of other books by the same author for the "More by [author]"
 * inline preview — best-effort like the rest of the search integration: a
 * failure here shouldn't block the book detail page from rendering.
 */
async function getMoreByAuthor(author: string, currentBookId: string) {
	let results;
	try {
		results = await searchBooks(author);
	} catch {
		return [];
	}

	const others = results
		.filter((r) => r.author?.toLowerCase() === author.toLowerCase())
		.slice(0, 20);

	if (others.length === 0) return [];

	const matchConditions = others
		.flatMap((r) => [
			r.openLibraryId ? eq(books.openLibraryId, r.openLibraryId) : undefined,
			r.isbn ? eq(books.isbn, r.isbn) : undefined
		])
		.filter((c) => c !== undefined);

	const existing = matchConditions.length
		? await db
				.select()
				.from(books)
				.where(or(...matchConditions))
		: [];

	const seenTitles = new Set<string>();
	const preview: {
		title: string;
		coverUrl: string | null;
		libraryBookId: string | null;
	}[] = [];

	for (const result of others) {
		const normalizedTitle = result.title.trim().toLowerCase();
		if (!normalizedTitle || seenTitles.has(normalizedTitle)) continue;

		const match = existing.find(
			(b) =>
				(result.openLibraryId && b.openLibraryId === result.openLibraryId) ||
				(result.isbn && b.isbn === result.isbn)
		);

		// Excludes the book whose detail page this preview appears on.
		if (match?.id === currentBookId) continue;

		seenTitles.add(normalizedTitle);
		preview.push({
			title: result.title,
			coverUrl: result.coverUrl,
			libraryBookId: match?.id ?? null
		});

		if (preview.length >= MORE_BY_AUTHOR_LIMIT) break;
	}

	return preview;
}

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

	// Not awaited — streamed in separately (see the {#await} in +page.svelte)
	// so this best-effort, live-network-call preview never blocks the rest of
	// the page, including the re-render after every other action on this
	// page (logging progress, tagging, etc. all call invalidateAll(), which
	// would otherwise re-run this live search every single time).
	const moreByAuthor = book.author ? getMoreByAuthor(book.author, book.id) : Promise.resolve([]);

	return { book, userBook, logs, totals, tagsByType, suggestionsByType, moreByAuthor };
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
		const startedAt = parseLocalDateInput(startedAtRaw) ?? new Date();

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

	// Takes the reader's actual current position (page number, or hours/minutes
	// elapsed) rather than an amount-since-last-time delta — readers know
	// where they left off far more readily than how much they read this
	// session. The delta the underlying ReadingLog schema/history/edit flow
	// still expects is computed here from the running total.
	logProgress: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const currentPageRaw = data.get('currentPage');
		const hoursRaw = data.get('hours');
		const minutesRaw = data.get('minutes');
		const note = String(data.get('note') ?? '').trim();

		const totals = await getProgressTotals(result.userBook.id);

		let pagesRead: number | undefined;
		let minutesRead: number | undefined;

		if (currentPageRaw) {
			pagesRead = Number(currentPageRaw) - totals.pages;
		} else if (hoursRaw != null && minutesRaw != null) {
			const currentTotalMinutes = Number(hoursRaw) * 60 + Number(minutesRaw);
			minutesRead = currentTotalMinutes - totals.minutes;
		}

		if (!pagesRead && !minutesRead) {
			return fail(400, { error: 'Enter an amount read' });
		}
		if ((pagesRead != null && pagesRead <= 0) || (minutesRead != null && minutesRead <= 0)) {
			return fail(400, { error: "That's not further than where you left off" });
		}

		await logProgress({
			userBookId: result.userBook.id,
			pagesRead,
			minutesRead,
			note: note || undefined
		});
	},

	// A Chapter Notes entry with no amount attached — for jotting a thought
	// down anytime, not just while logging progress read/listened.
	addNote: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const note = String(data.get('note') ?? '').trim();

		if (!note) {
			return fail(400, { error: 'Enter a note' });
		}

		await db.insert(readingLogs).values({ userBookId: result.userBook.id, note });
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

	deleteLog: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const logId = String(data.get('logId') ?? '');
		if (!logId) return fail(400, { error: 'Missing log id' });

		await deleteLog(logId);
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

	untoggleWantToRead: async ({ params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		await untoggleWantToRead(result.userBook.id);
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
		const note = String(data.get('note') ?? '').trim();

		const rating = ratingRaw ? Number(ratingRaw) : null;
		const finishedAt = parseLocalDateInput(finishedAtRaw) ?? new Date();

		await db
			.update(userBooks)
			.set({
				rating: rating != null && Number.isFinite(rating) ? rating : null,
				finishedAt
			})
			.where(eq(userBooks.id, result.userBook.id));

		if (note) {
			await db.insert(readingLogs).values({
				userBookId: result.userBook.id,
				note,
				loggedAt: finishedAt
			});
		}
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
