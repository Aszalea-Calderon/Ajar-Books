import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { getLibraryBooks } from '$lib/server/books/library';
import { classifyFiction, type FictionCategory } from './genreClassification';

export type GenreCount = { genre: string; count: number };

/**
 * Count of finished-or-in-progress-or-tracked books per genre tag, sorted
 * descending. A book with multiple genre tags counts once toward each —
 * matches how the genre filter elsewhere treats multi-genre books.
 */
export async function getGenreBreakdown(): Promise<GenreCount[]> {
	const libraryBooks = await getLibraryBooks();
	const counts = new Map<string, number>();
	for (const { tags } of libraryBooks) {
		for (const genre of tags.genre) {
			counts.set(genre, (counts.get(genre) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([genre, count]) => ({ genre, count }))
		.sort((a, b) => b.count - a.count);
}

export type FictionSplit = Record<FictionCategory, number>;

/** Classifies every library book by its genre tags — see genreClassification.ts for the rules. */
export async function getFictionSplit(): Promise<FictionSplit> {
	const libraryBooks = await getLibraryBooks();
	const split: FictionSplit = { fiction: 0, nonfiction: 0, unclassified: 0 };
	for (const { tags } of libraryBooks) {
		split[classifyFiction(tags.genre)]++;
	}
	return split;
}

export type YearCount = { year: number; count: number };

/** Books finished per calendar year, sorted ascending by year (oldest first, for a left-to-right trend read). */
export async function getBooksFinishedByYear(): Promise<YearCount[]> {
	const rows = await db
		.select({ finishedAt: userBooks.finishedAt })
		.from(userBooks)
		.where(isNotNull(userBooks.finishedAt));

	const counts = new Map<number, number>();
	for (const row of rows) {
		const year = row.finishedAt!.getFullYear();
		counts.set(year, (counts.get(year) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => a.year - b.year);
}

export type MonthlyMetrics = {
	month: string; // "YYYY-MM"
	booksFinished: number;
	minutesRead: number;
	pagesRead: number;
};

/**
 * Last `monthsBack` calendar months (oldest first), each metric bucketed
 * independently by its own date field (finishedAt for books, loggedAt for
 * pages/minutes) rather than assuming they move together in lockstep.
 * Fetch-then-reduce-in-JS, matching the established pattern in calendar.ts.
 */
export async function getMonthlyMetrics(monthsBack = 6): Promise<MonthlyMetrics[]> {
	const now = new Date();
	const months: string[] = [];
	for (let i = monthsBack - 1; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
	}
	const byMonth = new Map<string, MonthlyMetrics>(
		months.map((month) => [month, { month, booksFinished: 0, minutesRead: 0, pagesRead: 0 }])
	);

	const finishedRows = await db
		.select({ finishedAt: userBooks.finishedAt })
		.from(userBooks)
		.where(isNotNull(userBooks.finishedAt));
	for (const row of finishedRows) {
		const key = monthKey(row.finishedAt!);
		const bucket = byMonth.get(key);
		if (bucket) bucket.booksFinished++;
	}

	const logRows = await db
		.select({
			loggedAt: readingLogs.loggedAt,
			pagesRead: readingLogs.pagesRead,
			minutesRead: readingLogs.minutesRead
		})
		.from(readingLogs)
		.innerJoin(userBooks, eq(readingLogs.userBookId, userBooks.id));
	for (const row of logRows) {
		const key = monthKey(row.loggedAt);
		const bucket = byMonth.get(key);
		if (!bucket) continue;
		bucket.pagesRead += row.pagesRead ?? 0;
		bucket.minutesRead += row.minutesRead ?? 0;
	}

	return months.map((month) => byMonth.get(month)!);
}

function monthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export type PublicationYearBucket = { label: string; count: number };

/**
 * Buckets by decade once the library's publication-year spread exceeds 50
 * years (StoryGraph-style charts do the same) — otherwise individual years
 * would mostly be empty. Books with no publicationYear are excluded rather
 * than lumped into a misleading "unknown" bar.
 */
export async function getPublicationYearSpread(): Promise<PublicationYearBucket[]> {
	const rows = await db
		.select({ publicationYear: books.publicationYear })
		.from(books)
		.innerJoin(userBooks, eq(userBooks.bookId, books.id))
		.where(isNotNull(books.publicationYear));

	const years = rows.map((r) => r.publicationYear!);
	if (years.length === 0) return [];

	const min = Math.min(...years);
	const max = Math.max(...years);
	const useDecades = max - min > 50;

	const counts = new Map<number, number>();
	for (const year of years) {
		const bucketKey = useDecades ? Math.floor(year / 10) * 10 : year;
		counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
	}

	return [...counts.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([key, count]) => ({ label: useDecades ? `${key}s` : String(key), count }));
}
