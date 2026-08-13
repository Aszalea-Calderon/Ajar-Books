import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkAlreadyInLibrary } from '$lib/server/import/preview';
import type { ImportRow } from '$lib/import/types';

// Called from the preview step, before anything is committed — lets it show
// which rows will merge into a book already in the library instead of only
// finding out from the results summary after Import runs.
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const { rows } = (await request.json()) as { rows: ImportRow[] };
	if (!Array.isArray(rows)) {
		return json({ error: 'Expected { rows: ImportRow[] }' }, { status: 400 });
	}

	const matches = await checkAlreadyInLibrary(rows);
	return json({ matches });
};
