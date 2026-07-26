import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { books, userBooks } from '$lib/server/db/schema';
import { getProgressTotals } from '$lib/server/books/progress';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ book: books, userBook: userBooks })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id))
		.where(eq(userBooks.status, 'reading'))
		.orderBy(desc(userBooks.startedAt));

	const currentlyReading = await Promise.all(
		rows.map(async (row) => ({ ...row, totals: await getProgressTotals(row.userBook.id) }))
	);

	return { currentlyReading };
};
