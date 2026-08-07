import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { searchBooks, type BookSearchResult } from '$lib/server/books/search';
import { addBookToLibrary } from '$lib/server/books/library';
import { setStatus, untoggleWantToRead } from '$lib/server/books/progress';
import { db } from '$lib/server/db';
import { books, tags, userBookTags, userBooks } from '$lib/server/db/schema';

// Cross-references live search results against books already in the local
// library (by Open Library id or ISBN) so the UI can show "already in
// library" instead of a duplicate add button, and whether the bookmark
// toggle should render as already-checked.
async function attachLibraryIds(results: BookSearchResult[]) {
	const matchConditions = results
		.flatMap((r) => [
			r.openLibraryId ? eq(books.openLibraryId, r.openLibraryId) : undefined,
			r.isbn ? eq(books.isbn, r.isbn) : undefined
		])
		.filter((c) => c !== undefined);

	const existing = matchConditions.length
		? await db
				.select({ book: books, status: userBooks.status })
				.from(books)
				.leftJoin(userBooks, eq(userBooks.bookId, books.id))
				.where(or(...matchConditions))
		: [];

	return results.map((r) => {
		const match = existing.find(
			({ book }) =>
				(r.openLibraryId && book.openLibraryId === r.openLibraryId) ||
				(r.isbn && book.isbn === r.isbn)
		);
		return {
			...r,
			libraryBookId: match?.book.id ?? null,
			isWantToRead: match?.status === 'want_to_read'
		};
	});
}

// A lightweight "what to read next" nudge shown before the user searches for
// anything — not a real recommendation engine, just their own Want to Read
// list grouped by genre so it's not a blank page. A book with multiple genre
// tags only appears once, under whichever tag sorts first alphabetically
// (stable/deterministic) — repeating it under every genre it's tagged with
// read as clutter in a short list; one with no genre tags falls into a
// catch-all bucket rather than being silently dropped.
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
		const genres = genresByUserBook.get(row.userBookId) ?? [];
		const genre =
			genres.length > 0 ? [...genres].sort((a, b) => a.localeCompare(b))[0] : NO_GENRE_BUCKET;
		const list = groups.get(genre) ?? [];
		list.push(row.book);
		groups.set(genre, list);
	}

	return [...groups.entries()]
		.map(([genre, genreBooks]) => ({ genre, books: genreBooks }))
		.sort((a, b) => a.genre.localeCompare(b.genre));
}

// Shown only to a genuinely first-time user (empty library, not just an
// empty Want to Read list — see hasAnyBooks below) in place of a blank
// pre-search page. Deliberately just title/author, not full search results —
// no cover art or Open Library id is fabricated; clicking one runs a real
// search for it, going through the same verified add/bookmark flow as any
// other result.
const STARTER_RECOMMENDATIONS: { genre: string; books: { title: string; author: string }[] }[] = [
	{
		genre: 'Fantasy',
		books: [
			{ title: 'The Hobbit', author: 'J.R.R. Tolkien' },
			{ title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin' },
			{ title: 'Mistborn: The Final Empire', author: 'Brandon Sanderson' }
		]
	},
	{
		genre: 'Mystery',
		books: [
			{ title: 'And Then There Were None', author: 'Agatha Christie' },
			{ title: 'The Big Sleep', author: 'Raymond Chandler' },
			{ title: 'Gone Girl', author: 'Gillian Flynn' }
		]
	},
	{
		genre: 'Romance',
		books: [
			{ title: 'Pride and Prejudice', author: 'Jane Austen' },
			{ title: 'The Hating Game', author: 'Sally Thorne' },
			{ title: 'Outlander', author: 'Diana Gabaldon' }
		]
	},
	{
		genre: 'Science Fiction',
		books: [
			{ title: 'Dune', author: 'Frank Herbert' },
			{ title: 'The Martian', author: 'Andy Weir' },
			{ title: "Ender's Game", author: 'Orson Scott Card' }
		]
	},
	{
		genre: 'Classics',
		books: [
			{ title: 'To Kill a Mockingbird', author: 'Harper Lee' },
			{ title: '1984', author: 'George Orwell' },
			{ title: 'Jane Eyre', author: 'Charlotte Brontë' }
		]
	}
];

async function hasAnyBooks() {
	const [row] = await db.select({ id: books.id }).from(books).limit(1);
	return !!row;
}

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) {
		const wantToReadByGenre = await getWantToReadByGenre();
		const starterRecommendations =
			wantToReadByGenre.length === 0 && !(await hasAnyBooks()) ? STARTER_RECOMMENDATIONS : [];
		return {
			query,
			results: [],
			hasMore: false,
			wantToReadByGenre,
			starterRecommendations
		};
	}

	try {
		const { results, hasMore } = await searchBooks(query);
		const resultsWithLibraryId = await attachLibraryIds(results);
		return {
			query,
			results: resultsWithLibraryId,
			hasMore,
			wantToReadByGenre: [],
			starterRecommendations: []
		};
	} catch {
		// Open Library/Google Books are third-party services outside our
		// control — a timeout or outage there shouldn't crash the whole page,
		// just report the search as failed so the user can retry.
		return {
			query,
			results: [],
			hasMore: false,
			wantToReadByGenre: [],
			starterRecommendations: [],
			searchFailed: true
		};
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
			genres: data.getAll('genres').map(String)
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

		const { bookId, userBookId } = await addBookToLibrary({
			title,
			author: String(data.get('author') ?? '') || null,
			coverUrl: String(data.get('coverUrl') ?? '') || null,
			openLibraryId: String(data.get('openLibraryId') ?? '') || null,
			isbn: String(data.get('isbn') ?? '') || null,
			description: String(data.get('description') ?? '') || null,
			pageCount: pageCountRaw ? Number(pageCountRaw) : null,
			publicationYear: publicationYearRaw ? Number(publicationYearRaw) : null,
			genres: data.getAll('genres').map(String)
		});

		await setStatus(userBookId, 'want_to_read');

		// Returned so the client can patch its already-loaded result list in
		// place instead of re-running the whole (external-API-backed) search
		// load just to learn the bookId a bookmark click just created.
		return { bookId };
	},

	// Unchecking the bookmark on a result already in the library — mirrors
	// StatusControl's own "Want to Read" untoggle, just reachable from search
	// too. Only needs the bookId (already resolved by attachLibraryIds); a
	// book that was never added has nothing to untoggle.
	removeFromWantToRead: async ({ request }) => {
		const data = await request.formData();
		const bookId = String(data.get('bookId') ?? '');
		if (!bookId) return fail(400, { error: 'Missing bookId' });

		const [userBook] = await db.select().from(userBooks).where(eq(userBooks.bookId, bookId));
		if (userBook) await untoggleWantToRead(userBook.id);
	}
};
