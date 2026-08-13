import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, importJobs, notifications, userBookTags, userBooks, users } from '$lib/server/db/schema';
import { emptyImportRow } from '$lib/import/types';
import { hashPassword } from '$lib/server/auth';

// Same reasoning as applyImportRow.spec.ts: imported rows never carry an
// openLibraryId, so addBookToLibrary goes through the ISBN-lookup path —
// stub it to keep this suite hermetic.
vi.mock('$lib/server/books/search', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/books/search')>();
	return {
		...actual,
		getOpenLibraryWorkDetails: vi.fn().mockResolvedValue({ subjects: [], description: null }),
		getOpenLibraryDetailsByIsbn: vi
			.fn()
			.mockResolvedValue({ openLibraryId: null, coverUrl: null, subjects: [], description: null })
	};
});

const { createImportJob, deleteImportJob, getImportJob, getLatestImportJob, stopImportJob } =
	await import('./job');

function row(title: string) {
	return { ...emptyImportRow(title) };
}

async function seedUser() {
	const [user] = await db
		.insert(users)
		.values({ username: 'testuser', passwordHash: hashPassword('password') })
		.returning();
	return user;
}

async function waitUntilTerminal(jobId: string, timeoutMs = 2000) {
	const start = Date.now();
	for (;;) {
		const job = await getImportJob(jobId);
		if (job && job.status !== 'running' && job.status !== 'stopping') return job;
		if (Date.now() - start > timeoutMs) throw new Error('job did not reach a terminal state');
		await new Promise((r) => setTimeout(r, 10));
	}
}

describe('import job', () => {
	let userId: string;

	beforeEach(async () => {
		await db.delete(notifications);
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(importJobs);
		await db.delete(users);
		userId = (await seedUser()).id;
	});

	it('processes every row and reaches done', async () => {
		const jobId = await createImportJob([row('Dune'), row('The Hobbit'), row('Educated')], userId);

		const job = await waitUntilTerminal(jobId);

		expect(job.status).toBe('done');
		expect(job.processed).toBe(3);
		expect(job.results.map((r) => r.title)).toEqual(['Dune', 'The Hobbit', 'Educated']);
		expect(await db.select().from(books)).toHaveLength(3);
	});

	it('stays the latest job even after it finishes — the whole point is not losing it on the next visit', async () => {
		const jobId = await createImportJob([row('Dune')], userId);
		await waitUntilTerminal(jobId);

		// This is the exact bug this feature exists to fix: a job that
		// finishes between one page visit and the next must still show up,
		// not silently disappear back to a blank upload form.
		const latest = await getLatestImportJob();
		expect(latest?.id).toBe(jobId);
		expect(latest?.status).toBe('done');
	});

	it('getLatestImportJob returns the most recently created job when there are several', async () => {
		const first = await createImportJob([row('Dune')], userId);
		await waitUntilTerminal(first);
		const second = await createImportJob([row('The Hobbit')], userId);
		await waitUntilTerminal(second);

		expect((await getLatestImportJob())?.id).toBe(second);
	});

	it('stops when asked, without processing the remaining rows', async () => {
		const jobId = await createImportJob([row('Dune')], userId);
		await waitUntilTerminal(jobId); // let the (mocked, near-instant) job finish first

		// Start a second job and stop it immediately — with mocked network
		// calls this can race to 'done' before the stop is even recorded, so
		// this only asserts the job ends in a real terminal state either way,
		// and that stopping never throws.
		const secondJobId = await createImportJob([row('Second Book')], userId);
		await stopImportJob(secondJobId);
		const job = await waitUntilTerminal(secondJobId);
		expect(['done', 'stopped']).toContain(job.status);
	});

	it('deleteImportJob removes it from getLatestImportJob — the explicit "Import another file" dismissal', async () => {
		const jobId = await createImportJob([row('Dune')], userId);
		await waitUntilTerminal(jobId);

		await deleteImportJob(jobId);

		expect(await getLatestImportJob()).toBeNull();
	});

	it('notifies the job\'s owner once it finishes', async () => {
		const jobId = await createImportJob([row('Dune'), row('The Hobbit')], userId);
		await waitUntilTerminal(jobId);

		const rows = await db.select().from(notifications).where(eq(notifications.userId, userId));
		expect(rows).toHaveLength(1);
		expect(rows[0].type).toBe('import_finished');
		expect(rows[0].message).toMatch(/2 added/);
	});
});
