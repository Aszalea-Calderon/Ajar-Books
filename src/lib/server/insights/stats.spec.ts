import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, readingLogs, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import { addTag } from '$lib/server/books/tags';
import {
	getBooksFinishedByYear,
	getFictionSplit,
	getGenreBreakdown,
	getMonthlyMetrics,
	getPublicationYearSpread
} from './stats';

// getLibraryBooks() excludes status 'added' (the untouched, never-decided
// default) — everything here needs a real status to be counted at all.
async function seedBook(overrides: { title?: string; publicationYear?: number | null } = {}) {
	const [book] = await db
		.insert(books)
		.values({ title: overrides.title ?? 'Test Book', publicationYear: overrides.publicationYear })
		.returning();
	const [userBook] = await db
		.insert(userBooks)
		.values({ bookId: book.id, status: 'want_to_read' })
		.returning();
	return userBook;
}

describe('insights stats', () => {
	beforeEach(async () => {
		await db.delete(readingLogs);
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
	});

	describe('getGenreBreakdown', () => {
		it('counts a multi-genre book once per genre', async () => {
			const userBook = await seedBook();
			await addTag(userBook.id, 'genre', 'Fantasy');
			await addTag(userBook.id, 'genre', 'Young Adult');
			const userBook2 = await seedBook({ title: 'Second' });
			await addTag(userBook2.id, 'genre', 'Fantasy');

			const breakdown = await getGenreBreakdown();
			expect(breakdown).toEqual([
				{ genre: 'Fantasy', count: 2 },
				{ genre: 'Young Adult', count: 1 }
			]);
		});

		it('returns an empty list with no library books', async () => {
			expect(await getGenreBreakdown()).toEqual([]);
		});
	});

	describe('getFictionSplit', () => {
		it('classifies fiction, nonfiction, and untagged books', async () => {
			const fiction = await seedBook({ title: 'Fiction' });
			await addTag(fiction.id, 'genre', 'Fantasy');
			const nonfiction = await seedBook({ title: 'Nonfiction' });
			await addTag(nonfiction.id, 'genre', 'History');
			await seedBook({ title: 'Untagged' });

			expect(await getFictionSplit()).toEqual({ fiction: 1, nonfiction: 1, unclassified: 1 });
		});

		it('prefers fiction when a book carries both a fiction and nonfiction genre tag', async () => {
			const book = await seedBook();
			await addTag(book.id, 'genre', 'Historical Fiction');
			await addTag(book.id, 'genre', 'History');

			expect(await getFictionSplit()).toEqual({ fiction: 1, nonfiction: 0, unclassified: 0 });
		});
	});

	describe('getBooksFinishedByYear', () => {
		it('buckets by finish year, ascending', async () => {
			const a = await seedBook({ title: 'A' });
			const b = await seedBook({ title: 'B' });
			const c = await seedBook({ title: 'C' });
			await db
				.update(userBooks)
				.set({ finishedAt: new Date(2025, 5, 1) })
				.where(eq(userBooks.id, a.id));
			await db
				.update(userBooks)
				.set({ finishedAt: new Date(2025, 8, 1) })
				.where(eq(userBooks.id, b.id));
			await db
				.update(userBooks)
				.set({ finishedAt: new Date(2024, 1, 1) })
				.where(eq(userBooks.id, c.id));

			expect(await getBooksFinishedByYear()).toEqual([
				{ year: 2024, count: 1 },
				{ year: 2025, count: 2 }
			]);
		});

		it('ignores books with no finishedAt', async () => {
			await seedBook();
			expect(await getBooksFinishedByYear()).toEqual([]);
		});
	});

	describe('getMonthlyMetrics', () => {
		it('sums pages/minutes from logs and counts finishes per month, independently bucketed', async () => {
			const now = new Date();
			const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5);
			const book = await seedBook();
			await db
				.update(userBooks)
				.set({ finishedAt: thisMonth })
				.where(eq(userBooks.id, book.id));
			await db.insert(readingLogs).values({ userBookId: book.id, pagesRead: 30, loggedAt: thisMonth });
			await db.insert(readingLogs).values({ userBookId: book.id, minutesRead: 45, loggedAt: thisMonth });

			const metrics = await getMonthlyMetrics(3);
			expect(metrics).toHaveLength(3);
			const current = metrics.at(-1)!;
			expect(current.booksFinished).toBe(1);
			expect(current.pagesRead).toBe(30);
			expect(current.minutesRead).toBe(45);
			expect(metrics[0].booksFinished).toBe(0);
		});
	});

	describe('getPublicationYearSpread', () => {
		it('buckets by individual year when the spread is under 50 years', async () => {
			await seedBook({ publicationYear: 2010 });
			await seedBook({ publicationYear: 2010 });
			await seedBook({ publicationYear: 2015 });

			expect(await getPublicationYearSpread()).toEqual([
				{ label: '2010', count: 2 },
				{ label: '2015', count: 1 }
			]);
		});

		it('buckets by decade when the spread exceeds 50 years', async () => {
			await seedBook({ publicationYear: 1932 });
			await seedBook({ publicationYear: 1945 });
			await seedBook({ publicationYear: 2020 });

			expect(await getPublicationYearSpread()).toEqual([
				{ label: '1930s', count: 1 },
				{ label: '1940s', count: 1 },
				{ label: '2020s', count: 1 }
			]);
		});

		it('excludes books with no publication year', async () => {
			await seedBook({ publicationYear: null });
			expect(await getPublicationYearSpread()).toEqual([]);
		});
	});
});
