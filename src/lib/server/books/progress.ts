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
 * Promotes to "finished" once the logged total meets the declared goal, and
 * demotes back to "reading" if an edit drops the total back below it —
 * status always reflects the current totals, in either direction.
 */
async function recomputeStatus(userBookId: string) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, userBookId));
	if (!userBook) throw new Error('UserBook not found');

	const totals = await getProgressTotals(userBookId);

	const pagesComplete = userBook.totalPages != null && totals.pages >= userBook.totalPages;
	const minutesComplete = userBook.totalMinutes != null && totals.minutes >= userBook.totalMinutes;
	const isComplete = pagesComplete || minutesComplete;

	const updates: Partial<typeof userBooks.$inferInsert> = {};

	if (isComplete && userBook.status !== 'finished') {
		updates.status = 'finished';
		updates.finishedAt = new Date();
	} else if (!isComplete && userBook.status === 'finished') {
		updates.status = 'reading';
		updates.finishedAt = null;
	}

	if (Object.keys(updates).length > 0) {
		await db.update(userBooks).set(updates).where(eq(userBooks.id, userBookId));
	}

	return totals;
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

	if (userBook.status === 'want_to_read') {
		await db
			.update(userBooks)
			.set({ status: 'reading', startedAt: new Date() })
			.where(eq(userBooks.id, params.userBookId));
	}

	return recomputeStatus(params.userBookId);
}

/**
 * Corrects an existing reading-log entry's amount and/or note, then
 * re-derives status from the edited totals (see recomputeStatus).
 */
export async function editProgress(params: {
	logId: string;
	pagesRead?: number;
	minutesRead?: number;
	note?: string;
}) {
	const [log] = await db.select().from(readingLogs).where(eq(readingLogs.id, params.logId));
	if (!log) throw new Error('ReadingLog not found');

	await db
		.update(readingLogs)
		.set({
			pagesRead: params.pagesRead ?? null,
			minutesRead: params.minutesRead ?? null,
			note: params.note || null
		})
		.where(eq(readingLogs.id, params.logId));

	return recomputeStatus(log.userBookId);
}

export type BookStatus = 'want_to_read' | 'reading' | 'finished' | 'dnf';

/**
 * Manual status override, independent of the automatic progress-based
 * transitions above. Fills in started/finished timestamps the first time
 * each status is reached, but never clears them on a later manual change —
 * that history stays meaningful even if you move a book back to "reading".
 */
export async function setStatus(userBookId: string, status: BookStatus) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, userBookId));
	if (!userBook) throw new Error('UserBook not found');

	const updates: Partial<typeof userBooks.$inferInsert> = { status };

	if (status === 'reading' && !userBook.startedAt) {
		updates.startedAt = new Date();
	}
	if (status === 'finished' && !userBook.finishedAt) {
		updates.finishedAt = new Date();
	}

	await db.update(userBooks).set(updates).where(eq(userBooks.id, userBookId));
}

/**
 * "Remove book": a soft alternative to hard Delete. Wipes this book's
 * reading history and resets it to a fresh, never-tracked state, but keeps
 * the Book row and its tags — only the reading-progress side is reset.
 */
export async function resetUserBook(userBookId: string) {
	await db.delete(readingLogs).where(eq(readingLogs.userBookId, userBookId));
	await db
		.update(userBooks)
		.set({
			status: 'want_to_read',
			format: null,
			totalPages: null,
			totalMinutes: null,
			rating: null,
			startedAt: null,
			finishedAt: null
		})
		.where(eq(userBooks.id, userBookId));
}
