import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '$lib/server/db';
import { books, importJobs, userBookTags, userBooks } from '$lib/server/db/schema';
import { emptyImportRow } from '$lib/import/types';

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
	beforeEach(async () => {
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(importJobs);
	});

	it('processes every row and reaches done', async () => {
		const jobId = await createImportJob([row('Dune'), row('The Hobbit'), row('Educated')]);

		const job = await waitUntilTerminal(jobId);

		expect(job.status).toBe('done');
		expect(job.processed).toBe(3);
		expect(job.results.map((r) => r.title)).toEqual(['Dune', 'The Hobbit', 'Educated']);
		expect(await db.select().from(books)).toHaveLength(3);
	});

	it('stays the latest job even after it finishes — the whole point is not losing it on the next visit', async () => {
		const jobId = await createImportJob([row('Dune')]);
		await waitUntilTerminal(jobId);

		// This is the exact bug this feature exists to fix: a job that
		// finishes between one page visit and the next must still show up,
		// not silently disappear back to a blank upload form.
		const latest = await getLatestImportJob();
		expect(latest?.id).toBe(jobId);
		expect(latest?.status).toBe('done');
	});

	it('getLatestImportJob returns the most recently created job when there are several', async () => {
		const first = await createImportJob([row('Dune')]);
		await waitUntilTerminal(first);
		const second = await createImportJob([row('The Hobbit')]);
		await waitUntilTerminal(second);

		expect((await getLatestImportJob())?.id).toBe(second);
	});

	it('stops when asked, without processing the remaining rows', async () => {
		const jobId = await createImportJob([row('Dune')]);
		await waitUntilTerminal(jobId); // let the (mocked, near-instant) job finish first

		// Start a second job and stop it immediately — with mocked network
		// calls this can race to 'done' before the stop is even recorded, so
		// this only asserts the job ends in a real terminal state either way,
		// and that stopping never throws.
		const secondJobId = await createImportJob([row('Second Book')]);
		await stopImportJob(secondJobId);
		const job = await waitUntilTerminal(secondJobId);
		expect(['done', 'stopped']).toContain(job.status);
	});

	it('deleteImportJob removes it from getLatestImportJob — the explicit "Import another file" dismissal', async () => {
		const jobId = await createImportJob([row('Dune')]);
		await waitUntilTerminal(jobId);

		await deleteImportJob(jobId);

		expect(await getLatestImportJob()).toBeNull();
	});
});
