import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, readingLogs, userBooks } from '$lib/server/db/schema';
import {
	editProgress,
	getProgressTotals,
	getProgressTotalsForBooks,
	logProgress,
	resetUserBook,
	setStatus,
	untoggleWantToRead
} from './progress';

async function seedUserBook(overrides: Partial<typeof userBooks.$inferInsert> = {}) {
	const [book] = await db.insert(books).values({ title: 'Test Book' }).returning();
	const [userBook] = await db
		.insert(userBooks)
		.values({ bookId: book.id, status: 'want_to_read', ...overrides })
		.returning();
	return userBook;
}

describe('getProgressTotals', () => {
	it('returns zero for a book with no logged progress', async () => {
		const userBook = await seedUserBook();
		expect(await getProgressTotals(userBook.id)).toEqual({ pages: 0, minutes: 0 });
	});
});

describe('getProgressTotalsForBooks', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('returns an empty map for an empty list, with no query', async () => {
		expect(await getProgressTotalsForBooks([])).toEqual(new Map());
	});

	it('batches totals for several books in one call, matching getProgressTotals per book', async () => {
		const bookA = await seedUserBook({ format: 'physical', totalPages: 500 });
		const bookB = await seedUserBook({ format: 'audiobook', totalMinutes: 600 });
		await logProgress({ userBookId: bookA.id, pagesRead: 120 });
		await logProgress({ userBookId: bookB.id, minutesRead: 45 });

		const totals = await getProgressTotalsForBooks([bookA.id, bookB.id]);

		expect(totals.get(bookA.id)).toEqual({ pages: 120, minutes: 0 });
		expect(totals.get(bookB.id)).toEqual({ pages: 0, minutes: 45 });
	});

	it('omits an id with no logged progress from the map rather than returning a zero entry', async () => {
		const userBook = await seedUserBook();
		const totals = await getProgressTotalsForBooks([userBook.id]);
		expect(totals.has(userBook.id)).toBe(false);
	});
});

describe('logProgress', () => {
	beforeEach(async () => {
		// vitest module isolation gives each test file its own :memory: db, but
		// tests within this file share it — clear between tests.
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('accumulates pages across multiple log entries', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });

		await logProgress({ userBookId: userBook.id, pagesRead: 100 });
		await logProgress({ userBookId: userBook.id, pagesRead: 150 });
		const totals = await logProgress({ userBookId: userBook.id, pagesRead: 50 });

		expect(totals).toEqual({ pages: 300, minutes: 0 });
	});

	it('accumulates minutes across multiple log entries for audiobooks', async () => {
		const userBook = await seedUserBook({ format: 'audiobook', totalMinutes: 680 });

		await logProgress({ userBookId: userBook.id, minutesRead: 200 });
		const totals = await logProgress({ userBookId: userBook.id, minutesRead: 112 });

		expect(totals).toEqual({ pages: 0, minutes: 312 });
	});

	it('stores an optional note on the log entry', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });
		await logProgress({ userBookId: userBook.id, pagesRead: 10, note: 'Great opening' });

		// No direct getter for logs in this module; assert indirectly via the
		// same table other code reads from.
		const { readingLogs } = await import('$lib/server/db/schema');
		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));
		expect(log.note).toBe('Great opening');
	});

	it('backdates the log entry when loggedAt is passed (retroactive logging)', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });
		const pastDate = new Date(2020, 0, 15);

		await logProgress({ userBookId: userBook.id, pagesRead: 10, loggedAt: pastDate });

		const { readingLogs } = await import('$lib/server/db/schema');
		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));
		expect(log.loggedAt).toEqual(pastDate);
	});

	it('defaults loggedAt to now when omitted', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });
		// SQLite integer timestamps round to the second, so allow for that
		// rather than asserting exact millisecond precision.
		const before = Date.now() - 1000;

		await logProgress({ userBookId: userBook.id, pagesRead: 10 });

		const { readingLogs } = await import('$lib/server/db/schema');
		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));
		expect(log.loggedAt.getTime()).toBeGreaterThanOrEqual(before);
	});

	it('promotes want_to_read to reading on the first logged session', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });
		expect(userBook.status).toBe('want_to_read');

		await logProgress({ userBookId: userBook.id, pagesRead: 10 });

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('reading');
		expect(updated.startedAt).not.toBeNull();
	});

	it('promotes the untouched "added" status to reading on the first logged session', async () => {
		const userBook = await seedUserBook({
			status: 'added',
			format: 'physical',
			totalPages: 500
		});

		await logProgress({ userBookId: userBook.id, pagesRead: 10 });

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('reading');
		expect(updated.startedAt).not.toBeNull();
	});

	it('finishes a page-based book once the logged total meets or exceeds totalPages', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'physical',
			totalPages: 300
		});

		await logProgress({ userBookId: userBook.id, pagesRead: 299 });
		let [current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('reading');

		await logProgress({ userBookId: userBook.id, pagesRead: 1 });
		[current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('finished');
		expect(current.finishedAt).not.toBeNull();
	});

	it('finishes a time-based (audiobook) book once minutes meet or exceed totalMinutes', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'audiobook',
			totalMinutes: 100
		});

		await logProgress({ userBookId: userBook.id, minutesRead: 100 });

		const [current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('finished');
	});

	it('does not finish a book with no declared total, no matter how much is logged', async () => {
		const userBook = await seedUserBook({ status: 'reading', format: 'physical' });

		await logProgress({ userBookId: userBook.id, pagesRead: 100000 });

		const [current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('reading');
	});

	it('throws for a userBookId that does not exist', async () => {
		await expect(logProgress({ userBookId: 'does-not-exist', pagesRead: 1 })).rejects.toThrow();
	});
});

describe('editProgress', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('updates the amount and note on an existing log entry', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'physical',
			totalPages: 500
		});
		await logProgress({ userBookId: userBook.id, pagesRead: 50, note: 'Slow start' });
		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));

		await editProgress({ logId: log.id, pagesRead: 80, note: 'Actually picking up' });

		const [updatedLog] = await db.select().from(readingLogs).where(eq(readingLogs.id, log.id));
		expect(updatedLog.pagesRead).toBe(80);
		expect(updatedLog.note).toBe('Actually picking up');
	});

	it('re-finishes a book when an edit pushes the total over the goal', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'physical',
			totalPages: 300
		});
		await logProgress({ userBookId: userBook.id, pagesRead: 100 });
		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));

		await editProgress({ logId: log.id, pagesRead: 300 });

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('finished');
		expect(updated.finishedAt).not.toBeNull();
	});

	it('demotes a finished book back to reading when an edit drops the total below the goal', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'physical',
			totalPages: 300
		});
		await logProgress({ userBookId: userBook.id, pagesRead: 300 });
		let [current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('finished');

		const [log] = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));
		await editProgress({ logId: log.id, pagesRead: 100 });

		[current] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(current.status).toBe('reading');
		expect(current.finishedAt).toBeNull();
	});

	it('throws for a logId that does not exist', async () => {
		await expect(editProgress({ logId: 'does-not-exist', pagesRead: 1 })).rejects.toThrow();
	});
});

describe('setStatus', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('sets the status directly, independent of any logged progress', async () => {
		const userBook = await seedUserBook({ status: 'want_to_read' });

		await setStatus(userBook.id, 'finished');

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('finished');
		expect(updated.finishedAt).not.toBeNull();
	});

	it('fills startedAt/finishedAt only the first time each status is reached', async () => {
		const userBook = await seedUserBook({ status: 'want_to_read' });

		await setStatus(userBook.id, 'finished');
		const [firstFinish] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		const finishedAt = firstFinish.finishedAt;
		expect(finishedAt).not.toBeNull();

		await setStatus(userBook.id, 'reading');
		await setStatus(userBook.id, 'finished');

		const [secondFinish] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(secondFinish.finishedAt).toEqual(finishedAt);
	});

	it('throws for a userBookId that does not exist', async () => {
		await expect(setStatus('does-not-exist', 'finished')).rejects.toThrow();
	});
});

describe('resetUserBook', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('clears logs and resets format/progress/rating/dates to the neutral added state', async () => {
		const userBook = await seedUserBook({
			status: 'reading',
			format: 'physical',
			totalPages: 300,
			rating: 4
		});
		await logProgress({ userBookId: userBook.id, pagesRead: 100 });

		await resetUserBook(userBook.id);

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		// Not 'want_to_read' — that's meant to be a deliberate choice (the
		// bookmark), not something a reset performs on your behalf.
		expect(updated.status).toBe('added');
		expect(updated.format).toBeNull();
		expect(updated.totalPages).toBeNull();
		expect(updated.totalMinutes).toBeNull();
		expect(updated.rating).toBeNull();
		expect(updated.startedAt).toBeNull();
		expect(updated.finishedAt).toBeNull();

		const remainingLogs = await db
			.select()
			.from(readingLogs)
			.where(eq(readingLogs.userBookId, userBook.id));
		expect(remainingLogs).toHaveLength(0);
	});
});

describe('untoggleWantToRead', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('flips a want_to_read book back to the neutral added state', async () => {
		const userBook = await seedUserBook({ status: 'want_to_read' });

		await untoggleWantToRead(userBook.id);

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('added');
	});

	it('does nothing if the book has moved past want_to_read since the click', async () => {
		const userBook = await seedUserBook({ status: 'reading' });

		await untoggleWantToRead(userBook.id);

		const [updated] = await db.select().from(userBooks).where(eq(userBooks.id, userBook.id));
		expect(updated.status).toBe('reading');
	});
});
