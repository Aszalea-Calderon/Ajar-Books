import { db } from '$lib/server/db';
import { userBooks, readingLogs } from '$lib/server/db/schema';
import { and, eq, isNull, sql, sum } from 'drizzle-orm';

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

	const updates: Record<string, unknown> = {};

	if (isComplete && userBook.status !== 'finished') {
		updates.status = 'finished';
		updates.finishedAt = new Date();
		updates.timesFinished = sql`${userBooks.timesFinished} + 1`;
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
 * total (pages or minutes) finishes it. `loggedAt` defaults to now (the
 * schema's own default) — pass it explicitly for a retroactive/backfilled
 * entry (e.g. logging from a past day on the calendar).
 */
export async function logProgress(params: {
	userBookId: string;
	pagesRead?: number;
	minutesRead?: number;
	note?: string;
	loggedAt?: Date;
}) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, params.userBookId));
	if (!userBook) throw new Error('UserBook not found');

	await db.insert(readingLogs).values({
		userBookId: params.userBookId,
		pagesRead: params.pagesRead,
		minutesRead: params.minutesRead,
		note: params.note || null,
		...(params.loggedAt ? { loggedAt: params.loggedAt } : {})
	});

	if (userBook.status === 'want_to_read' || userBook.status === 'added') {
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

/**
 * Removes a reading-log entry entirely (as opposed to editProgress, which
 * corrects one in place), then re-derives status from what's left — deleting
 * the log that pushed a book over its goal un-finishes it, same as editing
 * its amount down would.
 */
export async function deleteLog(logId: string) {
	const [log] = await db.select().from(readingLogs).where(eq(readingLogs.id, logId));
	if (!log) throw new Error('ReadingLog not found');

	await db.delete(readingLogs).where(eq(readingLogs.id, logId));

	return recomputeStatus(log.userBookId);
}

export type BookStatus = 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf';

/**
 * Manual status override, independent of the automatic progress-based
 * transitions above. Fills in started/finished timestamps the first time
 * each status is reached, but never clears them on a later manual change —
 * that history stays meaningful even if you move a book back to "reading".
 */
export async function setStatus(userBookId: string, status: BookStatus) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, userBookId));
	if (!userBook) throw new Error('UserBook not found');

	const updates: Record<string, unknown> = { status };

	if (status === 'reading' && !userBook.startedAt) {
		updates.startedAt = new Date();
	}
	if (status === 'finished' && !userBook.finishedAt) {
		updates.finishedAt = new Date();
	}
	if (status === 'finished' && userBook.status !== 'finished') {
		updates.timesFinished = sql`${userBooks.timesFinished} + 1`;
	}

	await db.update(userBooks).set(updates).where(eq(userBooks.id, userBookId));
}

/**
 * Untoggles "Want to Read" back to the neutral 'added' state — the one
 * exception to 'added' otherwise being a one-way-exit-only marker (see
 * setStatus). Only takes effect if the book is still actually in
 * 'want_to_read' (defensive against a stale client re-submitting after the
 * status already moved on).
 */
export async function untoggleWantToRead(userBookId: string) {
	const [userBook] = await db.select().from(userBooks).where(eq(userBooks.id, userBookId));
	if (!userBook || userBook.status !== 'want_to_read') return;

	await db.update(userBooks).set({ status: 'added' }).where(eq(userBooks.id, userBookId));
}

/**
 * Soft reset (alternative to hard Delete): clears this book's progress and
 * lands it back on the neutral 'added' state, not 'want_to_read' — choosing
 * "Want to Read" is meant to be a deliberate action, not something a reset
 * performs on your behalf. Keeps the Book row and its tags — only the
 * reading-progress side resets. Only drops amount-only log entries (plain
 * page/minute counts, meaningless once the goal they counted toward is
 * gone); entries with a note are kept, since those are the reader's own
 * words and a hard Delete is the only action meant to erase those.
 */
export async function resetUserBook(userBookId: string) {
	await db
		.delete(readingLogs)
		.where(and(eq(readingLogs.userBookId, userBookId), isNull(readingLogs.note)));
	await db
		.update(userBooks)
		.set({
			status: 'added',
			format: null,
			totalPages: null,
			totalMinutes: null,
			rating: null,
			startedAt: null,
			finishedAt: null,
			timesFinished: 0
		})
		.where(eq(userBooks.id, userBookId));
}
