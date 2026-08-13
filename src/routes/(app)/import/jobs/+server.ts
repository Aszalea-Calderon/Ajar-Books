import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createImportJob } from '$lib/server/import/job';
import type { ImportRow } from '$lib/import/types';

// Takes the whole already-parsed-and-mapped row set in one request (parsing
// still happens client-side, same as before) and hands it off to a
// server-driven job — see job.ts for why, versus the old per-batch loop.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { rows } = (await request.json()) as { rows: ImportRow[] };

	if (!Array.isArray(rows) || rows.length === 0) {
		return json({ error: 'Expected { rows: ImportRow[] }' }, { status: 400 });
	}

	const jobId = await createImportJob(rows, locals.user.id);
	return json({ jobId });
};
