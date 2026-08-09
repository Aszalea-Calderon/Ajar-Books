import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { books, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import { addTag } from './tags';

vi.mock('./search', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./search')>();
	return {
		...actual,
		getOpenLibraryWorkDetails: vi.fn().mockResolvedValue({ subjects: [], description: null }),
		getOpenLibraryDetailsByIsbn: vi
			.fn()
			.mockResolvedValue({ openLibraryId: null, coverUrl: null, subjects: [], description: null })
	};
});

const { getOpenLibraryWorkDetails, getOpenLibraryDetailsByIsbn } = await import('./search');
const { backfillMissingMetadata } = await import('./backfill');

async function seedImportedBook(overrides: {
	title?: string;
	isbn?: string | null;
	openLibraryId?: string | null;
	coverUrl?: string | null;
	description?: string | null;
}) {
	const [book] = await db
		.insert(books)
		.values({
			title: overrides.title ?? 'Test Book',
			isbn: overrides.isbn ?? null,
			openLibraryId: overrides.openLibraryId ?? null,
			coverUrl: overrides.coverUrl ?? null,
			description: overrides.description ?? null
		})
		.returning();
	const [userBook] = await db
		.insert(userBooks)
		.values({ bookId: book.id, status: 'want_to_read' })
		.returning();
	return { book, userBook };
}

describe('backfillMissingMetadata', () => {
	beforeEach(async () => {
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
		vi.mocked(getOpenLibraryWorkDetails)
			.mockReset()
			.mockResolvedValue({ subjects: [], description: null });
		vi.mocked(getOpenLibraryDetailsByIsbn)
			.mockReset()
			.mockResolvedValue({ openLibraryId: null, coverUrl: null, subjects: [], description: null });
	});

	it('backfills cover, description, and genre for an imported book via ISBN', async () => {
		vi.mocked(getOpenLibraryDetailsByIsbn).mockResolvedValueOnce({
			openLibraryId: '/works/OL999W',
			coverUrl: 'https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg',
			subjects: ['Fantasy'],
			description: 'A backfilled description.'
		});
		const { book, userBook } = await seedImportedBook({ isbn: '9780441013593' });

		const outcomes = await backfillMissingMetadata();

		expect(outcomes).toEqual([{ bookId: book.id, title: book.title, updated: expect.any(Array) }]);
		expect(outcomes[0].updated.sort()).toEqual(['cover', 'description', 'genre', 'openLibraryId']);

		const [updated] = await db.select().from(books).where(eq(books.id, book.id));
		expect(updated.coverUrl).toBe('https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg');
		expect(updated.description).toBe('A backfilled description.');
		expect(updated.openLibraryId).toBe('/works/OL999W');

		const genreRows = await db
			.select()
			.from(userBookTags)
			.innerJoin(tags, eq(userBookTags.tagId, tags.id))
			.where(eq(userBookTags.userBookId, userBook.id));
		expect(genreRows.map((r) => r.tags.name)).toEqual(['Fantasy']);
	});

	it('uses the work-details lookup instead of ISBN when openLibraryId is already known', async () => {
		vi.mocked(getOpenLibraryWorkDetails).mockResolvedValueOnce({
			subjects: [],
			description: 'From the work endpoint.'
		});
		const { book } = await seedImportedBook({ openLibraryId: '/works/OL111W', isbn: '9780441013593' });

		await backfillMissingMetadata();

		expect(getOpenLibraryWorkDetails).toHaveBeenCalledWith('/works/OL111W');
		expect(getOpenLibraryDetailsByIsbn).not.toHaveBeenCalled();
		const [updated] = await db.select().from(books).where(eq(books.id, book.id));
		expect(updated.description).toBe('From the work endpoint.');
	});

	it('never overrides genre tags a book already has', async () => {
		vi.mocked(getOpenLibraryDetailsByIsbn).mockResolvedValueOnce({
			openLibraryId: null,
			coverUrl: null,
			subjects: ['Mystery'],
			description: 'desc'
		});
		const { userBook } = await seedImportedBook({ isbn: '9780441013593' });
		await addTag(userBook.id, 'genre', 'Romance');

		await backfillMissingMetadata();

		const genreTags = await db
			.select()
			.from(userBookTags)
			.innerJoin(tags, eq(userBookTags.tagId, tags.id))
			.where(eq(userBookTags.userBookId, userBook.id));
		expect(genreTags.map((r) => r.tags.name)).toEqual(['Romance']);
	});

	it('skips books that already have both cover and description', async () => {
		await seedImportedBook({
			isbn: '9780441013593',
			coverUrl: 'https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg',
			description: 'Already there.'
		});

		const outcomes = await backfillMissingMetadata();

		expect(outcomes).toEqual([]);
		expect(getOpenLibraryDetailsByIsbn).not.toHaveBeenCalled();
	});

	it('skips books with neither an isbn nor an openLibraryId — nothing to look them up by', async () => {
		await seedImportedBook({ isbn: null, openLibraryId: null });

		const outcomes = await backfillMissingMetadata();

		expect(outcomes).toEqual([]);
	});

	it('only patches the specific fields still missing, leaving existing ones alone', async () => {
		vi.mocked(getOpenLibraryDetailsByIsbn).mockResolvedValueOnce({
			openLibraryId: '/works/OL222W',
			coverUrl: 'https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg',
			subjects: [],
			description: 'Should not be used — description already present.'
		});
		const { book } = await seedImportedBook({
			isbn: '9780441013593',
			description: 'Original description',
			coverUrl: null
		});

		const outcomes = await backfillMissingMetadata();

		expect(outcomes[0].updated).toEqual(['cover', 'openLibraryId']);
		const [updated] = await db.select().from(books).where(eq(books.id, book.id));
		expect(updated.description).toBe('Original description');
		expect(updated.coverUrl).toBe('https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg');
	});
});
