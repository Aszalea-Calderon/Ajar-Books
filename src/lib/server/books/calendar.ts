import { and, eq, gte, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { toLocalDateInputValue } from '$lib/date';

/**
 * Local-date-string set of every day with any logged activity, full
 * history — independent of whichever month is currently being viewed, so
 * streak stays pinned to today regardless of calendar navigation.
 * Unbounded (not windowed to a recent lookback) because this now also
 * backs the all-time longest-streak calculation, not just the current
 * streak; a single user's log volume makes a full scan cheap.
 */
export async function getStreakActiveDates(): Promise<Set<string>> {
	const rows = await db.select({ loggedAt: readingLogs.loggedAt }).from(readingLogs);

	return new Set(rows.map((row) => toLocalDateInputValue(row.loggedAt)));
}

export type MonthActivityEntry = {
	bookId: string;
	bookTitle: string;
	coverUrl: string | null;
	pagesRead: number | null;
	minutesRead: number | null;
	note: string | null;
};

/**
 * Reading-log entries in [monthStart, monthEnd), bucketed by local date
 * string — feeds both the calendar's day cells (which need bookId/coverUrl
 * to render cover thumbnails) and the day-detail view. Fetch-then-reduce-
 * in-JS, matching the style already used for the dashboard's "last
 * activity per book" lookup rather than a SQL GROUP BY.
 */
export async function getMonthActivity(
	monthStart: Date,
	monthEnd: Date
): Promise<Map<string, MonthActivityEntry[]>> {
	const rows = await db
		.select({
			loggedAt: readingLogs.loggedAt,
			pagesRead: readingLogs.pagesRead,
			minutesRead: readingLogs.minutesRead,
			note: readingLogs.note,
			bookId: books.id,
			bookTitle: books.title,
			coverUrl: books.coverUrl
		})
		.from(readingLogs)
		.innerJoin(userBooks, eq(readingLogs.userBookId, userBooks.id))
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(and(gte(readingLogs.loggedAt, monthStart), lt(readingLogs.loggedAt, monthEnd)));

	const byDate = new Map<string, MonthActivityEntry[]>();
	for (const row of rows) {
		const key = toLocalDateInputValue(row.loggedAt);
		const entry: MonthActivityEntry = {
			bookId: row.bookId,
			bookTitle: row.bookTitle,
			coverUrl: row.coverUrl,
			pagesRead: row.pagesRead,
			minutesRead: row.minutesRead,
			note: row.note
		};
		const existing = byDate.get(key);
		if (existing) existing.push(entry);
		else byDate.set(key, [entry]);
	}
	return byDate;
}
