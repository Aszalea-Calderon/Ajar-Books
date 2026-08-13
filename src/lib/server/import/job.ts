import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { importJobs } from '$lib/server/db/schema';
import { applyImportRow, type ImportRowResult } from './applyImportRow';
import type { ImportRow } from '$lib/import/types';

export type ImportJob = {
	id: string;
	status: 'running' | 'stopping' | 'done' | 'stopped' | 'error';
	total: number;
	processed: number;
	results: ImportRowResult[];
};

function toImportJob(row: typeof importJobs.$inferSelect): ImportJob {
	return {
		id: row.id,
		status: row.status,
		total: row.total,
		processed: row.processed,
		results: row.results as ImportRowResult[]
	};
}

/**
 * Runs (or resumes) a job's rows server-side, independent of any client
 * connection — this is the actual fix for the old client-driven batch loop
 * losing all progress when the browser tab went away. Not awaited by its
 * caller: kicked off and left to keep going against the database on its
 * own, the same way any other background work would in a long-running
 * Node process (this app has no serverless/request-scoped lifetime to
 * worry about).
 *
 * Resumable by construction: starts from `processed`, not 0, so calling
 * this again for a job already partway through (e.g. after a server
 * restart, see resumeInterruptedJobs below) continues instead of redoing
 * work or duplicating rows.
 */
async function runJob(jobId: string): Promise<void> {
	const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
	if (!job || job.status !== 'running') return;

	const rows = job.rows as ImportRow[];
	const results = [...(job.results as ImportRowResult[])];
	let processed = job.processed;

	for (let i = processed; i < rows.length; i++) {
		const [current] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
		if (!current || current.status === 'stopping') {
			await db
				.update(importJobs)
				.set({ status: 'stopped' })
				.where(eq(importJobs.id, jobId));
			return;
		}

		const result = await applyImportRow(rows[i]);
		results.push(result);
		processed = i + 1;

		await db.update(importJobs).set({ processed, results }).where(eq(importJobs.id, jobId));
	}

	await db.update(importJobs).set({ status: 'done' }).where(eq(importJobs.id, jobId));
}

/**
 * The most recent job regardless of status, not just 'running' — a job that
 * finished (or stopped/errored) in the seconds between this tab closing and
 * the next one opening is exactly the case this whole feature exists for;
 * silently dropping back to a blank upload form the moment it crosses into
 * 'done' would just move the same "leave and lose your results" bug a few
 * seconds later instead of actually fixing it. Only ever cleared by an
 * explicit "Import another file" (see deleteImportJob) — reopening /import
 * otherwise always shows whatever your last import did, finished or not.
 */
export async function getLatestImportJob(): Promise<ImportJob | null> {
	// createdAt alone isn't a reliable tiebreaker — millisecond resolution,
	// and two jobs can genuinely land in the same millisecond (confirmed by
	// a flaky test before this fix). SQLite's own rowid strictly increases
	// with insertion order regardless, so it's the real tiebreaker here.
	const [job] = await db
		.select()
		.from(importJobs)
		.orderBy(desc(importJobs.createdAt), desc(sql`rowid`))
		.limit(1);
	return job ? toImportJob(job) : null;
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
	const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
	return job ? toImportJob(job) : null;
}

export async function deleteImportJob(jobId: string): Promise<void> {
	await db.delete(importJobs).where(eq(importJobs.id, jobId));
}

export async function createImportJob(rows: ImportRow[]): Promise<string> {
	const [job] = await db
		.insert(importJobs)
		.values({ rows, total: rows.length, results: [] })
		.returning();
	runJob(job.id); // deliberately not awaited — see runJob's own comment
	return job.id;
}

export async function stopImportJob(jobId: string): Promise<void> {
	await db.update(importJobs).set({ status: 'stopping' }).where(eq(importJobs.id, jobId));
}

/**
 * Picks back up any job still marked 'running' when this module first
 * loads — the state a job is left in if the server process itself restarts
 * mid-import (a code change during dev, a container restart), as opposed
 * to just a closed browser tab (which never stopped the server-side loop
 * in the first place). Fire-and-forget at module scope, same pattern as
 * the rest of this file — safe to call more than once since runJob no-ops
 * on anything not still 'running'.
 */
async function resumeInterruptedJobs(): Promise<void> {
	const stale = await db.select().from(importJobs).where(eq(importJobs.status, 'running'));
	for (const job of stale) runJob(job.id);
}

resumeInterruptedJobs();
