import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import { checkAlreadyInLibrary } from './preview';

async function seedLibraryBook(book: { title: string; author?: string | null; isbn?: string | null }) {
	const [row] = await db
		.insert(books)
		.values({ title: book.title, author: book.author ?? null, isbn: book.isbn ?? null })
		.returning();
	await db.insert(userBooks).values({ bookId: row.id });
	return row;
}

describe('checkAlreadyInLibrary', () => {
	beforeEach(async () => {
		await db.delete(userBooks);
		await db.delete(books);
	});

	it('matches by ISBN regardless of title/author', async () => {
		await seedLibraryBook({ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' });

		const [matched] = await checkAlreadyInLibrary([
			{ title: 'Some Other Title', author: null, isbn: '9780441013593' }
		]);

		expect(matched).toBe(true);
	});

	it('falls back to case-insensitive title+author when there is no ISBN', async () => {
		await seedLibraryBook({ title: 'Dune', author: 'Frank Herbert', isbn: null });

		const [matched] = await checkAlreadyInLibrary([
			{ title: 'DUNE', author: 'frank herbert', isbn: null }
		]);

		expect(matched).toBe(true);
	});

	it('matches by title alone when the row has no author', async () => {
		await seedLibraryBook({ title: 'Dune', author: 'Frank Herbert', isbn: null });

		const [matched] = await checkAlreadyInLibrary([{ title: 'Dune', author: null, isbn: null }]);

		expect(matched).toBe(true);
	});

	it('does not match a different author for the same title', async () => {
		await seedLibraryBook({ title: 'Educated', author: 'Tara Westover', isbn: null });

		const [matched] = await checkAlreadyInLibrary([
			{ title: 'Educated', author: 'Someone Else', isbn: null }
		]);

		expect(matched).toBe(false);
	});

	it('does not match a book that exists but has no userBooks row', async () => {
		const [book] = await db
			.insert(books)
			.values({ title: 'Dune', author: 'Frank Herbert', isbn: null })
			.returning();
		expect(book).toBeTruthy();

		const [matched] = await checkAlreadyInLibrary([
			{ title: 'Dune', author: 'Frank Herbert', isbn: null }
		]);

		expect(matched).toBe(false);
	});

	it('returns false for a row with no match at all', async () => {
		const [matched] = await checkAlreadyInLibrary([
			{ title: 'Not In Library', author: null, isbn: null }
		]);

		expect(matched).toBe(false);
	});

	it('preserves row order across a mixed batch', async () => {
		await seedLibraryBook({ title: 'Dune', author: 'Frank Herbert', isbn: '111' });

		const results = await checkAlreadyInLibrary([
			{ title: 'Not In Library', author: null, isbn: null },
			{ title: 'Whatever', author: null, isbn: '111' },
			{ title: 'Also Not In Library', author: null, isbn: null }
		]);

		expect(results).toEqual([false, true, false]);
	});
});
