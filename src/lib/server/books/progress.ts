import { db } from '$lib/server/db';
import { userBooks, readingLogs } from '$lib/server/db/schema';
import { eq, sum } from 'drizzle-orm';

export async function getProgressTotals(userBookId: string) {
	const [row] = await db
		.select({
			pages: sum(readingLogs.pagesRead),
			minutes: sum(readingLogs.minutesRead)
		})
		.from(readingLogs)
		.where(eq(readingLogs.userBookId, userBookId));

	return {
		pages: Number(row?.pages ?? 0),
		minutes: Number(row?.minutes ?? 0)
	};
}

/**
 * Records a reading session and applies the status side effects: a log
 * against a want-to-read book starts it, and crossing the book's declared
 * total (pages or minutes) finishes it.
 */
export async function logProgress(params: {
	userBookId: string;
	pagesRead?: number;
	minutesRead?: number;
	note?: string;
}) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, params.userBookId));
	if (!userBook) throw new Error('UserBook not found');

	await db.insert(readingLogs).values({
		userBookId: params.userBookId,
		pagesRead: params.pagesRead,
		minutesRead: params.minutesRead,
		note: params.note || null
	});

	const totals = await getProgressTotals(params.userBookId);

	const updates: Partial<typeof userBooks.$inferInsert> = {};

	if (userBook.status === 'want_to_read') {
		updates.status = 'reading';
		updates.startedAt = new Date();
	}

	const pagesComplete = userBook.totalPages != null && totals.pages >= userBook.totalPages;
	const minutesComplete = userBook.totalMinutes != null && totals.minutes >= userBook.totalMinutes;

	if ((pagesComplete || minutesComplete) && userBook.status !== 'finished') {
		updates.status = 'finished';
		updates.finishedAt = new Date();
	}

	if (Object.keys(updates).length > 0) {
		await db.update(userBooks).set(updates).where(eq(userBooks.id, params.userBookId));
	}

	return totals;
}
