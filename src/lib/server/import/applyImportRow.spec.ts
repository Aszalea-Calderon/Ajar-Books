import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { books, userBooks, tags, userBookTags, readingLogs } from '$lib/server/db/schema';
import type { ImportRow } from '$lib/import/types';

// applyImportRow goes through addBookToLibrary, which calls out to Open
// Library for genre/description details on a genuinely new book with an
// openLibraryId — imported rows never have one (only ISBN), so this path
// never actually triggers, but stub it anyway to keep the suite hermetic
// and consistent with library.spec.ts's convention.
vi.mock('$lib/server/books/search', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/books/search')>();
	return {
		...actual,
		getOpenLibraryWorkDetails: vi.fn().mockResolvedValue({ subjects: [], description: null })
	};
});

const { applyImportRow } = await import('./applyImportRow');
const { getTagsForUserBook } = await import('$lib/server/books/tags');

function row(overrides: Partial<ImportRow> = {}): ImportRow {
	return {
		title: 'Dune',
		author: 'Frank Herbert',
		isbn: '9780441013593',
		pageCount: 412,
		publicationYear: 1965,
		status: 'finished',
		rating: 5,
		format: 'physical',
		finishedAt: '2023-06-15T00:00:00.000Z',
		dateAdded: '2023-01-02T00:00:00.000Z',
		timesFinished: 1,
		genres: ['Science Fiction'],
		moods: ['Epic'],
		note: null,
		...overrides
	};
}

describe('applyImportRow', () => {
	beforeEach(async () => {
		await db.delete(readingLogs);
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
	});

	it('creates a new book with status/rating/format/dates set directly (not via setStatus\'s "now")', async () => {
		const result = await applyImportRow(row());
		expect(result.outcome).toBe('added');

		const [userBook] = await db.select().from(userBooks);
		expect(userBook.status).toBe('finished');
		expect(userBook.rating).toBe(5);
		expect(userBook.format).toBe('physical');
		expect(userBook.finishedAt?.toISOString()).toBe('2023-06-15T00:00:00.000Z');
		expect(userBook.timesFinished).toBe(1);
	});

	it('applies genre and mood tags', async () => {
		const result = await applyImportRow(row());
		const [userBook] = await db.select().from(userBooks);
		const genres = await getTagsForUserBook(userBook.id, 'genre');
		const moods = await getTagsForUserBook(userBook.id, 'mood');
		expect(genres.map((t) => t.name)).toEqual(['Science Fiction']);
		expect(moods.map((t) => t.name)).toEqual(['Epic']);
		expect(result.outcome).toBe('added');
	});

	it('stores a non-empty note as a reading log entry', async () => {
		await applyImportRow(row({ note: 'Loved it.' }));
		const [userBook] = await db.select().from(userBooks);
		const logs = await db.select().from(readingLogs).where(eq(readingLogs.userBookId, userBook.id));
		expect(logs).toHaveLength(1);
		expect(logs[0].note).toBe('Loved it.');
	});

	it('dedupes a second import of the same ISBN instead of creating a duplicate book', async () => {
		await applyImportRow(row());
		const second = await applyImportRow(row());
		expect(second.outcome).toBe('merged');
		expect(await db.select().from(books)).toHaveLength(1);
		expect(await db.select().from(userBooks)).toHaveLength(1);
	});

	it('dedupes by case-insensitive title+author when there is no ISBN', async () => {
		await applyImportRow(row({ isbn: null }));
		const second = await applyImportRow(
			row({ isbn: null, title: 'DUNE', author: 'frank herbert' })
		);
		expect(second.outcome).toBe('merged');
		expect(await db.select().from(books)).toHaveLength(1);
	});

	it('does not merge two different books that happen to share no ISBN', async () => {
		await applyImportRow(row({ isbn: null, title: 'Dune' }));
		await applyImportRow(row({ isbn: null, title: 'Educated', author: 'Tara Westover' }));
		expect(await db.select().from(books)).toHaveLength(2);
	});

	it('returns an error outcome for a row with no title, without touching the DB', async () => {
		const result = await applyImportRow(row({ title: '   ' }));
		expect(result.outcome).toBe('error');
		expect(await db.select().from(books)).toHaveLength(0);
	});

	it('leaves status/rating/format/dates unset when the row has none', async () => {
		const result = await applyImportRow(
			row({
				status: null,
				rating: null,
				format: null,
				finishedAt: null,
				dateAdded: null,
				timesFinished: null,
				genres: [],
				moods: []
			})
		);
		expect(result.outcome).toBe('added');
		const [userBook] = await db.select().from(userBooks);
		expect(userBook.status).toBe('added');
		expect(userBook.rating).toBeNull();
		expect(userBook.format).toBeNull();
	});
});
