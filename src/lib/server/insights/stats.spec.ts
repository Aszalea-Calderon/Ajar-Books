import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, readingLogs, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import { addTag } from '$lib/server/books/tags';
import { getLibraryBooks } from '$lib/server/books/library';
import {
	getBooksFinishedByYear,
	getFictionSplit,
	getGenreBreakdown,
	getMonthlyMetrics,
	getMostReadAuthors,
	getPaceStats,
	getPublicationYearSpread
} from './stats';

// getLibraryBooks() excludes status 'added' (the untouched, never-decided
// default) — everything here needs a real status to be counted at all.
async function seedBook(
	overrides: { title?: string; author?: string | null; publicationYear?: number | null } = {}
) {
	const [book] = await db
		.insert(books)
		.values({
			title: overrides.title ?? 'Test Book',
			author: overrides.author,
			publicationYear: overrides.publicationYear
		})
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

			const breakdown = getGenreBreakdown(await getLibraryBooks());
			expect(breakdown).toEqual([
				{ genre: 'Fantasy', count: 2 },
				{ genre: 'Young Adult', count: 1 }
			]);
		});

		it('returns an empty list with no library books', async () => {
			expect(getGenreBreakdown(await getLibraryBooks())).toEqual([]);
		});
	});

	describe('getFictionSplit', () => {
		it('classifies fiction, nonfiction, and untagged books', async () => {
			const fiction = await seedBook({ title: 'Fiction' });
			await addTag(fiction.id, 'genre', 'Fantasy');
			const nonfiction = await seedBook({ title: 'Nonfiction' });
			await addTag(nonfiction.id, 'genre', 'History');
			await seedBook({ title: 'Untagged' });

			expect(getFictionSplit(await getLibraryBooks())).toEqual({
				fiction: 1,
				nonfiction: 1,
				unclassified: 1
			});
		});

		it('prefers fiction when a book carries both a fiction and nonfiction genre tag', async () => {
			const book = await seedBook();
			await addTag(book.id, 'genre', 'Historical Fiction');
			await addTag(book.id, 'genre', 'History');

			expect(getFictionSplit(await getLibraryBooks())).toEqual({
				fiction: 1,
				nonfiction: 0,
				unclassified: 0
			});
		});
	});

	describe('getMostReadAuthors', () => {
		it('counts books per author, descending, excluding authorless books', async () => {
			await seedBook({ title: 'A1', author: 'Ann Author' });
			await seedBook({ title: 'A2', author: 'Ann Author' });
			await seedBook({ title: 'B1', author: 'Bea Book' });
			await seedBook({ title: 'No Author' });

			const authors = getMostReadAuthors(await getLibraryBooks());
			expect(authors).toEqual([
				{ author: 'Ann Author', count: 2 },
				{ author: 'Bea Book', count: 1 }
			]);
		});

		it('respects the limit', async () => {
			await seedBook({ title: 'A', author: 'Author A' });
			await seedBook({ title: 'B', author: 'Author B' });

			expect(getMostReadAuthors(await getLibraryBooks(), 1)).toHaveLength(1);
		});

		it('returns an empty list with no library books', async () => {
			expect(getMostReadAuthors(await getLibraryBooks())).toEqual([]);
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

	describe('getPaceStats', () => {
		it('averages days-per-book from started/finished pairs', async () => {
			const a = await seedBook({ title: 'A' });
			await db
				.update(userBooks)
				.set({ startedAt: new Date(2025, 0, 1), finishedAt: new Date(2025, 0, 11) })
				.where(eq(userBooks.id, a.id));
			const b = await seedBook({ title: 'B' });
			await db
				.update(userBooks)
				.set({ startedAt: new Date(2025, 1, 1), finishedAt: new Date(2025, 1, 6) })
				.where(eq(userBooks.id, b.id));

			const stats = await getPaceStats();
			expect(stats.averageDaysPerBook).toBe(7.5); // (10 + 5) / 2
		});

		it('averages pages/minutes per active day, not per calendar day', async () => {
			const book = await seedBook();
			const day1 = new Date(2025, 0, 1);
			const day2 = new Date(2025, 0, 2);
			await db.insert(readingLogs).values({ userBookId: book.id, pagesRead: 20, loggedAt: day1 });
			await db.insert(readingLogs).values({ userBookId: book.id, pagesRead: 40, loggedAt: day2 });
			await db.insert(readingLogs).values({ userBookId: book.id, minutesRead: 30, loggedAt: day1 });

			const stats = await getPaceStats();
			expect(stats.pagesPerActiveDay).toBe(30); // (20 + 40) / 2 days with a pages entry
			expect(stats.minutesPerActiveDay).toBe(30); // 30 / 1 day with a minutes entry
		});

		it('keeps pages and minutes independent — a pages-only book leaves minutesPerActiveDay null, not 0', async () => {
			const book = await seedBook();
			await db.insert(readingLogs).values({ userBookId: book.id, pagesRead: 50, loggedAt: new Date() });

			const stats = await getPaceStats();
			expect(stats.pagesPerActiveDay).toBe(50);
			expect(stats.minutesPerActiveDay).toBeNull();
		});

		it('returns null for each stat with no data to compute it from', async () => {
			expect(await getPaceStats()).toEqual({
				averageDaysPerBook: null,
				pagesPerActiveDay: null,
				minutesPerActiveDay: null
			});
		});
	});
});
