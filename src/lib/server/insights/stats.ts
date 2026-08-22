import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { LibraryBook } from '$lib/server/books/library';
import { toLocalDateInputValue } from '$lib/date';
import { classifyFiction, type FictionCategory } from './genreClassification';

export type GenreCount = { genre: string; count: number };

/**
 * Count of finished-or-in-progress-or-tracked books per genre tag, sorted
 * descending. A book with multiple genre tags counts once toward each —
 * matches how the genre filter elsewhere treats multi-genre books. Takes
 * the already-fetched library rather than querying it itself — the
 * Insights page load needs the same rows for several stats at once (genre,
 * fiction split, most-read authors), so it fetches once and passes it in.
 */
export function getGenreBreakdown(libraryBooks: LibraryBook[]): GenreCount[] {
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
export function getFictionSplit(libraryBooks: LibraryBook[]): FictionSplit {
	const split: FictionSplit = { fiction: 0, nonfiction: 0, unclassified: 0 };
	for (const { tags } of libraryBooks) {
		split[classifyFiction(tags.genre)]++;
	}
	return split;
}

export type AuthorCount = { author: string; count: number };

/** Top `limit` authors by book count, descending — books with no author on file are excluded. */
export function getMostReadAuthors(libraryBooks: LibraryBook[], limit = 10): AuthorCount[] {
	const counts = new Map<string, number>();
	for (const { book } of libraryBooks) {
		if (!book.author) continue;
		counts.set(book.author, (counts.get(book.author) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([author, count]) => ({ author, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
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

export type PaceStats = {
	averageDaysPerBook: number | null;
	pagesPerActiveDay: number | null;
	minutesPerActiveDay: number | null;
};

/**
 * "Active day" (matching the streak feature's own definition — see
 * calendar.ts's getStreakActiveDates) rather than total calendar days since
 * you started tracking — pages/minutes-per-day is meant to answer "on a day
 * you actually read, how much do you get through," not be diluted by days
 * you didn't open a book at all. Each stat is independently null (not zero)
 * when there's nothing to compute it from yet, so the UI can say "not
 * enough data" instead of a misleading 0.
 */
export async function getPaceStats(): Promise<PaceStats> {
	const finishedRows = await db
		.select({ startedAt: userBooks.startedAt, finishedAt: userBooks.finishedAt })
		.from(userBooks)
		.where(and(isNotNull(userBooks.startedAt), isNotNull(userBooks.finishedAt)));

	const daysPerBook = finishedRows.map(
		(row) => (row.finishedAt!.getTime() - row.startedAt!.getTime()) / (1000 * 60 * 60 * 24)
	);
	const averageDaysPerBook = daysPerBook.length
		? round1(daysPerBook.reduce((a, b) => a + b, 0) / daysPerBook.length)
		: null;

	const logRows = await db
		.select({
			loggedAt: readingLogs.loggedAt,
			pagesRead: readingLogs.pagesRead,
			minutesRead: readingLogs.minutesRead
		})
		.from(readingLogs);

	// Tracked as two separate day-sets, not one shared "any activity that
	// day" set — a book logged purely in pages (the common physical/ebook
	// case) would otherwise drag minutesPerActiveDay down to a misleading 0
	// instead of leaving it null, just because *some* day had page activity.
	const pageDays = new Set<string>();
	const minuteDays = new Set<string>();
	let totalPages = 0;
	let totalMinutes = 0;
	for (const row of logRows) {
		const day = toLocalDateInputValue(row.loggedAt);
		if (row.pagesRead) {
			pageDays.add(day);
			totalPages += row.pagesRead;
		}
		if (row.minutesRead) {
			minuteDays.add(day);
			totalMinutes += row.minutesRead;
		}
	}

	return {
		averageDaysPerBook,
		pagesPerActiveDay: pageDays.size ? round1(totalPages / pageDays.size) : null,
		minutesPerActiveDay: minuteDays.size ? round1(totalMinutes / minuteDays.size) : null
	};
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}
