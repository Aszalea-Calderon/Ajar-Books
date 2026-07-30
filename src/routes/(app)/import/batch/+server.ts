import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { applyImportRow } from '$lib/server/import/applyImportRow';
import type { ImportRow } from '$lib/import/types';

// Parsing/mapping already happened client-side (see /import's wizard) — the
// client sends one already-normalized batch of rows at a time and renders a
// progress bar between calls, rather than uploading the raw file here and
// processing it all in one long-running request.
export const POST: RequestHandler = async ({ request }) => {
	const { rows } = (await request.json()) as { rows: ImportRow[] };

	if (!Array.isArray(rows)) {
		return json({ error: 'Expected { rows: ImportRow[] }' }, { status: 400 });
	}

	const results = [];
	for (const row of rows) {
		results.push(await applyImportRow(row));
	}

	return json({ results });
};
