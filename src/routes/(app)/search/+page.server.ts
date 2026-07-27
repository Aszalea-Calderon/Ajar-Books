import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { searchBooks, type BookSearchResult } from '$lib/server/books/search';
import { addBookToLibrary } from '$lib/server/books/library';
import { setStatus } from '$lib/server/books/progress';
import { db } from '$lib/server/db';
import { books, tags, userBookTags, userBooks } from '$lib/server/db/schema';

// Cross-references live search results against books already in the local
// library (by Open Library id or ISBN) so the UI can show "already in
// library" instead of a duplicate add button.
async function attachLibraryIds(results: BookSearchResult[]) {
	const matchConditions = results
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

	return results.map((r) => {
		const match = existing.find(
			(b) =>
				(r.openLibraryId && b.openLibraryId === r.openLibraryId) || (r.isbn && b.isbn === r.isbn)
		);
		return { ...r, libraryBookId: match?.id ?? null };
	});
}

// A lightweight "what to read next" nudge shown before the user searches for
// anything — not a real recommendation engine, just their own Want to Read
// list grouped by genre so it's not a blank page. A book with multiple
// genre tags appears once per genre; one with none falls into a catch-all
// bucket rather than being silently dropped.
const NO_GENRE_BUCKET = 'More to explore';

async function getWantToReadByGenre() {
	const rows = await db
		.select({ book: books, userBookId: userBooks.id })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(eq(userBooks.status, 'want_to_read'));

	if (rows.length === 0) return [];

	const userBookIds = rows.map((r) => r.userBookId);
	const genreRows = await db
		.select({ userBookId: userBookTags.userBookId, genre: tags.name })
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(and(eq(tags.type, 'genre'), inArray(userBookTags.userBookId, userBookIds)));

	const genresByUserBook = new Map<string, string[]>();
	for (const row of genreRows) {
		const list = genresByUserBook.get(row.userBookId) ?? [];
		list.push(row.genre);
		genresByUserBook.set(row.userBookId, list);
	}

	const groups = new Map<string, (typeof rows)[number]['book'][]>();
	for (const row of rows) {
		const genres = genresByUserBook.get(row.userBookId);
		const bucket = genres && genres.length > 0 ? genres : [NO_GENRE_BUCKET];
		for (const genre of bucket) {
			const list = groups.get(genre) ?? [];
			list.push(row.book);
			groups.set(genre, list);
		}
	}

	return [...groups.entries()]
		.map(([genre, genreBooks]) => ({ genre, books: genreBooks }))
		.sort((a, b) => a.genre.localeCompare(b.genre));
}

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) {
		return { query, results: [], hasMore: false, wantToReadByGenre: await getWantToReadByGenre() };
	}

	try {
		const { results, hasMore } = await searchBooks(query);
		const resultsWithLibraryId = await attachLibraryIds(results);
		return { query, results: resultsWithLibraryId, hasMore, wantToReadByGenre: [] };
	} catch {
		// Open Library/Google Books are third-party services outside our
		// control — a timeout or outage there shouldn't crash the whole page,
		// just report the search as failed so the user can retry.
		return { query, results: [], hasMore: false, wantToReadByGenre: [], searchFailed: true };
	}
};

export const actions: Actions = {
	loadMore: async ({ request }) => {
		const data = await request.formData();
		const query = String(data.get('q') ?? '').trim();
		const page = Number(data.get('page') ?? '1');

		if (!query || !Number.isInteger(page) || page < 1) {
			return fail(400, { error: 'Invalid search page request' });
		}

		try {
			const { results, hasMore } = await searchBooks(query, page);
			const resultsWithLibraryId = await attachLibraryIds(results);
			return { results: resultsWithLibraryId, hasMore };
		} catch {
			return fail(502, { error: 'Search is temporarily unavailable. Try again in a moment.' });
		}
	},

	add: async ({ request }) => {
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

	// A bookmark icon on each result for mass-adding to Want to Read without
	// leaving the search page — unlike `add`, doesn't redirect, so the user
	// can keep bookmarking more results from the same list.
	addToWantToRead: async ({ request }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '');

		if (!title) return fail(400, { error: 'Missing title' });

		const pageCountRaw = data.get('pageCount');
		const publicationYearRaw = data.get('publicationYear');

		const { userBookId } = await addBookToLibrary({
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

		await setStatus(userBookId, 'want_to_read');
	}
};
