import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stopImportJob } from '$lib/server/import/job';

export const POST: RequestHandler = async ({ params }) => {
	await stopImportJob(params.id);
	return json({ ok: true });
};
