import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import { getProgressTotals, logProgress } from './progress';

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

	it('promotes want_to_read to reading on the first logged session', async () => {
		const userBook = await seedUserBook({ format: 'physical', totalPages: 500 });
		expect(userBook.status).toBe('want_to_read');

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
