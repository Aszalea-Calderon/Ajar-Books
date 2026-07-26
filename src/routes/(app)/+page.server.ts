import { desc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import { getProgressTotals } from '$lib/server/books/progress';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ book: books, userBook: userBooks })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(eq(userBooks.status, 'reading'))
		.orderBy(desc(userBooks.startedAt));

	const userBookIds = rows.map((row) => row.userBook.id);

	// Most-recently-active book (last logged session) is the default hero,
	// not just whichever was started most recently — falls back to startedAt
	// for a book with no logs yet.
	const recentLogs = userBookIds.length
		? await db
				.select({ userBookId: readingLogs.userBookId, loggedAt: readingLogs.loggedAt })
				.from(readingLogs)
				.where(inArray(readingLogs.userBookId, userBookIds))
				.orderBy(desc(readingLogs.loggedAt))
		: [];

	const lastActivityByUserBook = new Map<string, Date>();
	for (const log of recentLogs) {
		if (!lastActivityByUserBook.has(log.userBookId)) {
			lastActivityByUserBook.set(log.userBookId, log.loggedAt);
		}
	}

	const currentlyReading = await Promise.all(
		rows.map(async (row) => ({ ...row, totals: await getProgressTotals(row.userBook.id) }))
	);

	currentlyReading.sort((a, b) => {
		const aTime = lastActivityByUserBook.get(a.userBook.id) ?? a.userBook.startedAt ?? new Date(0);
		const bTime = lastActivityByUserBook.get(b.userBook.id) ?? b.userBook.startedAt ?? new Date(0);
		return bTime.getTime() - aTime.getTime();
	});

	return { currentlyReading };
};
