import { fail, redirect } from '@sveltejs/kit';
import { eq, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { searchBooks } from '$lib/server/books/search';
import { addBookToLibrary } from '$lib/server/books/library';
import { db } from '$lib/server/db';
import { books } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	if (!query) return { query, results: [] };

	const results = await searchBooks(query);

	const matchConditions = results
		.flatMap((r) => [
			r.openLibraryId ? eq(books.openLibraryId, r.openLibraryId) : undefined,
			r.isbn ? eq(books.isbn, r.isbn) : undefined
		])
		.filter((c) => c !== undefined);

	const existing = matchConditions.length
		? await db
				.select()
				.from(books)
				.where(or(...matchConditions))
		: [];

	const resultsWithLibraryId = results.map((r) => {
		const match = existing.find(
			(b) =>
				(r.openLibraryId && b.openLibraryId === r.openLibraryId) || (r.isbn && b.isbn === r.isbn)
		);
		return { ...r, libraryBookId: match?.id ?? null };
	});

	return { query, results: resultsWithLibraryId };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const data = await request.formData();
		const title = String(data.get('title') ?? '');

		if (!title) return fail(400, { error: 'Missing title' });

		const pageCountRaw = data.get('pageCount');
		const publicationYearRaw = data.get('publicationYear');

		const { bookId } = await addBookToLibrary({
			title,
			author: String(data.get('author') ?? '') || null,
			coverUrl: String(data.get('coverUrl') ?? '') || null,
			openLibraryId: String(data.get('openLibraryId') ?? '') || null,
			isbn: String(data.get('isbn') ?? '') || null,
			description: String(data.get('description') ?? '') || null,
			pageCount: pageCountRaw ? Number(pageCountRaw) : null,
			publicationYear: publicationYearRaw ? Number(publicationYearRaw) : null
		});

		throw redirect(303, `/books/${bookId}`);
	}
};
