import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import { getTagsForUserBook } from './tags';
import type { BookSearchResult } from './search';

// addBookToLibrary calls out to Open Library for genre/description details —
// stub it so these tests stay hermetic (no real network) and we can control
// what a "new" book resolves to per-test.
vi.mock('./search', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./search')>();
	return {
		...actual,
		getOpenLibraryWorkDetails: vi.fn().mockResolvedValue({ subjects: [], description: null })
	};
});

const { getOpenLibraryWorkDetails } = await import('./search');
const { addBookToLibrary } = await import('./library');

function result(overrides: Partial<BookSearchResult> = {}): BookSearchResult {
	return {
		title: 'Dune',
		author: 'Frank Herbert',
		coverUrl: null,
		openLibraryId: '/works/OL123W',
		isbn: null,
		description: null,
		pageCount: null,
		publicationYear: null,
		genres: [],
		...overrides
	};
}

describe('addBookToLibrary', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
		vi.mocked(getOpenLibraryWorkDetails)
			.mockReset()
			.mockResolvedValue({ subjects: [], description: null });
	});

	it('creates a new Book and UserBook for a never-seen result', async () => {
		const outcome = await addBookToLibrary(result());

		expect(outcome.alreadyInLibrary).toBe(false);
		const allBooks = await db.select().from(books);
		expect(allBooks).toHaveLength(1);
		expect(allBooks[0].title).toBe('Dune');
	});

	it('creates the UserBook with status added by default (untouched, no status chosen yet)', async () => {
		const outcome = await addBookToLibrary(result());
		const [userBook] = await db
			.select()
			.from(userBooks)
			.where(eq(userBooks.id, outcome.userBookId));
		expect(userBook.status).toBe('added');
	});

	it('dedupes by openLibraryId — adding the same result twice does not create a duplicate', async () => {
		const first = await addBookToLibrary(result());
		const second = await addBookToLibrary(result());

		expect(first.bookId).toBe(second.bookId);
		expect(second.alreadyInLibrary).toBe(true);
		expect(await db.select().from(books)).toHaveLength(1);
		expect(await db.select().from(userBooks)).toHaveLength(1);
	});

	it('dedupes by isbn even without a matching openLibraryId (e.g. a Google Books re-add)', async () => {
		await addBookToLibrary(result({ openLibraryId: '/works/OL123W', isbn: '9780441013593' }));

		const viaGoogleBooks = await addBookToLibrary(
			result({ openLibraryId: null, isbn: '9780441013593' })
		);

		expect(viaGoogleBooks.alreadyInLibrary).toBe(true);
		expect(await db.select().from(books)).toHaveLength(1);
	});

	it('does not dedupe two different books with no shared identifier', async () => {
		await addBookToLibrary(result({ openLibraryId: '/works/OL123W', isbn: null }));
		await addBookToLibrary(
			result({ title: 'Educated', openLibraryId: '/works/OL456W', isbn: null })
		);

		expect(await db.select().from(books)).toHaveLength(2);
	});

	it('applies normalized genre tags from Open Library subjects for a genuinely new book', async () => {
		vi.mocked(getOpenLibraryWorkDetails).mockResolvedValueOnce({
			subjects: ['Fantasy fiction', 'Science fiction, American'],
			description: null
		});

		const outcome = await addBookToLibrary(result({ title: 'The Fifth Season' }));

		const genreTags = await getTagsForUserBook(outcome.userBookId, 'genre');
		expect(genreTags.map((t) => t.name).sort()).toEqual(['Fantasy', 'Science Fiction'].sort());
	});

	it('stores the description fetched from Open Library for a new book', async () => {
		vi.mocked(getOpenLibraryWorkDetails).mockResolvedValueOnce({
			subjects: [],
			description: 'A season of endings has begun.'
		});

		const outcome = await addBookToLibrary(result());

		const [book] = await db.select().from(books).where(eq(books.id, outcome.bookId));
		expect(book.description).toBe('A season of endings has begun.');
	});

	it('stores the page count from the search result', async () => {
		const outcome = await addBookToLibrary(result({ pageCount: 512 }));
		const [book] = await db.select().from(books).where(eq(books.id, outcome.bookId));
		expect(book.pageCount).toBe(512);
	});

	it('uses a description already present on the result (e.g. from Google Books) without fetching one', async () => {
		// A real Google Books result never has an openLibraryId, so the fetch
		// (which also supplies genre subjects) never triggers in this case.
		const outcome = await addBookToLibrary(
			result({
				openLibraryId: null,
				isbn: '9780441013593',
				description: 'Google Books description'
			})
		);

		const [book] = await db.select().from(books).where(eq(books.id, outcome.bookId));
		expect(book.description).toBe('Google Books description');
		expect(getOpenLibraryWorkDetails).not.toHaveBeenCalled();
	});

	it('leaves description null when nothing is available from either source', async () => {
		const outcome = await addBookToLibrary(result());
		const [book] = await db.select().from(books).where(eq(books.id, outcome.bookId));
		expect(book.description).toBeNull();
	});

	it('does not fetch work details again when re-adding an already-existing book', async () => {
		await addBookToLibrary(result());
		vi.mocked(getOpenLibraryWorkDetails).mockClear();

		await addBookToLibrary(result());

		expect(getOpenLibraryWorkDetails).not.toHaveBeenCalled();
	});

	it('does not fetch work details at all when the result has no openLibraryId', async () => {
		await addBookToLibrary(result({ openLibraryId: null, isbn: '9780441013593' }));
		expect(getOpenLibraryWorkDetails).not.toHaveBeenCalled();
	});
});
