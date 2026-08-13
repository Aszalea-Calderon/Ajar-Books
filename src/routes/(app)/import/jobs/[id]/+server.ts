import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteImportJob, getImportJob } from '$lib/server/import/job';

// Polled by the import page — including right after a fresh page load, so
// leaving and coming back (or the page just reopening after the browser/
// computer was asleep) picks the job's current state straight back up.
export const GET: RequestHandler = async ({ params }) => {
	const job = await getImportJob(params.id);
	if (!job) return error(404, 'Import job not found');
	return json(job);
};

// "Import another file" explicitly dismisses the last job's results — the
// only way one goes away, since getLatestImportJob otherwise always shows
// whatever the last import did.
export const DELETE: RequestHandler = async ({ params }) => {
	await deleteImportJob(params.id);
	return json({ ok: true });
};
