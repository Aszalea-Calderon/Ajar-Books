import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { parseLocalDateInput } from '$lib/date';
import { db } from '$lib/server/db';
import { books, userBookTags, userBooks, readingLogs } from '$lib/server/db/schema';
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
import { searchBooks, getCommunityRating, type BookSearchResult } from '$lib/server/books/search';
import { addBookToLibrary } from '$lib/server/books/library';
import {
	addTag,
	getSuggestedTagNames,
	getTagsForUserBook,
	removeTag,
	type TagType
} from '$lib/server/books/tags';

const TAG_TYPES: TagType[] = ['genre', 'mood', 'setting'];
const MORE_BY_AUTHOR_LIMIT = 8;
const RELATED_BOOKS_LIMIT = 8;

/**
 * Other books in the user's own library that share at least one genre tag
 * with this one — genre/theme-based, distinct from the author-based "More
 * by author" and "Also by author" sections. Purely a local lookup (no
 * network call), ranked by how many genre tags two books have in common.
 */
async function getRelatedBooksInLibrary(genreTagIds: string[], currentBookId: string) {
	if (genreTagIds.length === 0) return [];

	const rows = await db
		.select({ book: books })
		.from(userBookTags)
		.innerJoin(userBooks, eq(userBookTags.userBookId, userBooks.id))
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(and(inArray(userBookTags.tagId, genreTagIds), ne(books.id, currentBookId)));

	const countByBookId = new Map<string, { book: (typeof rows)[number]['book']; count: number }>();
	for (const row of rows) {
		const existing = countByBookId.get(row.book.id);
		if (existing) existing.count += 1;
		else countByBookId.set(row.book.id, { book: row.book, count: 1 });
	}

	return [...countByBookId.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, RELATED_BOOKS_LIMIT)
		.map((entry) => entry.book);
}

/**
 * A handful of other books by the same author for the "More by [author]"
 * inline preview — best-effort like the rest of the search integration: a
 * failure here shouldn't block the book detail page from rendering.
 */
async function getMoreByAuthor(author: string, currentBookId: string) {
	let results;
	try {
		({ results } = await searchBooks(author));
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
		// Carried along so clicking a not-yet-added cover can add it directly
		// (same one-click behavior as a Search result card) instead of only
		// being able to fall back to a text search for it.
		result: BookSearchResult;
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
			libraryBookId: match?.id ?? null,
			result
		});

		if (preview.length >= MORE_BY_AUTHOR_LIMIT) break;
	}

	return preview;
}

/**
 * Books already in the user's own library by the same author — distinct
 * from getMoreByAuthor's live external-search preview, this is a purely
 * local lookup (no network call) of what they've actually added, so it's
 * awaited directly rather than streamed.
 */
async function getOtherBooksByAuthorInLibrary(author: string, currentBookId: string) {
	const rows = await db
		.select({ id: books.id, title: books.title, coverUrl: books.coverUrl })
		.from(books)
		.where(and(eq(books.author, author), ne(books.id, currentBookId)));
	return rows;
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
	const otherBooksByAuthorInLibrary = book.author
		? await getOtherBooksByAuthorInLibrary(book.author, book.id)
		: [];
	const relatedBooks = await getRelatedBooksInLibrary(
		tagsByType.genre.map((tag) => tag.id),
		book.id
	);

	// Same not-awaited streaming pattern as moreByAuthor above — a live,
	// best-effort call that shouldn't block the page. Skipped entirely once
	// the user has rated the book themselves, since the community rating is
	// only ever shown as a fallback until then.
	const communityRating = userBook.rating ? Promise.resolve(null) : getCommunityRating(book);

	return {
		book,
		userBook,
		logs,
		totals,
		tagsByType,
		suggestionsByType,
		moreByAuthor,
		otherBooksByAuthorInLibrary,
		relatedBooks,
		communityRating
	};
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
		const currentPercentRaw = data.get('currentPercent');
		const note = String(data.get('note') ?? '').trim();

		const totals = await getProgressTotals(result.userBook.id);

		let pagesRead: number | undefined;
		let minutesRead: number | undefined;

		if (currentPercentRaw != null) {
			// A percentage means the same thing either way — convert it to
			// whichever absolute unit this book's goal is actually tracked in,
			// then fall through to the same delta math as the other modes.
			const percent = Math.max(0, Math.min(100, Number(currentPercentRaw)));
			if (result.userBook.totalPages) {
				pagesRead = Math.round((percent / 100) * result.userBook.totalPages) - totals.pages;
			} else if (result.userBook.totalMinutes) {
				minutesRead = Math.round((percent / 100) * result.userBook.totalMinutes) - totals.minutes;
			}
		} else if (currentPageRaw) {
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

	// Manual fallback for when neither Open Library nor Google Books has a
	// page count — also unblocks page-based progress tracking for this book,
	// since "Start Reading" has nothing else to prefill its total from.
	setPageCount: async ({ request, params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		const data = await request.formData();
		const pageCount = Number(data.get('pageCount'));
		if (!Number.isFinite(pageCount) || pageCount <= 0) {
			return fail(400, { error: 'Enter a valid page count' });
		}

		await db.update(books).set({ pageCount }).where(eq(books.id, result.book.id));
	},

	removeBook: async ({ params }) => {
		const result = await loadBookAndUserBook(params.id);
		if (!result) error(404, 'Book not found');

		await resetUserBook(result.userBook.id);
	},

	// Adds a "More by author" preview book directly, same one-click behavior
	// as a Search result card, instead of only linking out to a text search.
	addFromAuthor: async ({ request }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '');
		if (!title) return fail(400, { error: 'Missing title' });

		const pageCountRaw = data.get('pageCount');
		const publicationYearRaw = data.get('publicationYear');

		const { bookId } = await addBookToLibrary({
			title,
			author: String(data.get('author') ?? '') || null,
			coverUrl: String(data.get('coverUrl') ?? '') || null,
			openLibraryId: String(data.get('openLibraryId') ?? '') || null,
			isbn: String(data.get('isbn') ?? '') || null,
			description: String(data.get('description') ?? '') || null,
			pageCount: pageCountRaw ? Number(pageCountRaw) : null,
			publicationYear: publicationYearRaw ? Number(publicationYearRaw) : null,
			genres: []
		});

		throw redirect(303, `/books/${bookId}`);
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

		// The automatic crossing-the-goal path (recomputeStatus) already flips
		// status to 'finished' and counts the completion before this modal is
		// even shown — only count it here too when this is the sole transition
		// (the manual "Finished" pill path), so a completion is never counted
		// twice.
		const alreadyFinished = result.userBook.status === 'finished';

		await db
			.update(userBooks)
			.set({
				status: 'finished',
				rating: rating != null && Number.isFinite(rating) ? rating : null,
				finishedAt,
				...(alreadyFinished ? {} : { timesFinished: sql`${userBooks.timesFinished} + 1` })
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
