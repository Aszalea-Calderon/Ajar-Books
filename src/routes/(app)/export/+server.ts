import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { books, readingLogs, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

type TagsByType = { genre: string[]; mood: string[]; setting: string[] };

export const GET: RequestHandler = async () => {
	const rows = await db
		.select({ book: books, userBook: userBooks })
		.from(userBooks)
		.innerJoin(books, eq(userBooks.bookId, books.id));

	const tagRows = await db
		.select({ userBookId: userBookTags.userBookId, type: tags.type, name: tags.name })
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id));

	const logRows = await db.select().from(readingLogs);

	const tagsByUserBook = new Map<string, TagsByType>();
	for (const t of tagRows) {
		if (!tagsByUserBook.has(t.userBookId)) {
			tagsByUserBook.set(t.userBookId, { genre: [], mood: [], setting: [] });
		}
		tagsByUserBook.get(t.userBookId)![t.type].push(t.name);
	}

	const logsByUserBook = new Map<string, typeof logRows>();
	for (const log of logRows) {
		if (!logsByUserBook.has(log.userBookId)) logsByUserBook.set(log.userBookId, []);
		logsByUserBook.get(log.userBookId)!.push(log);
	}

	const exportData = {
		exportedAt: new Date().toISOString(),
		books: rows.map(({ book, userBook }) => ({
			title: book.title,
			author: book.author,
			isbn: book.isbn,
			openLibraryId: book.openLibraryId,
			description: book.description,
			pageCount: book.pageCount,
			status: userBook.status,
			format: userBook.format,
			totalPages: userBook.totalPages,
			totalMinutes: userBook.totalMinutes,
			rating: userBook.rating,
			startedAt: userBook.startedAt,
			finishedAt: userBook.finishedAt,
			tags: tagsByUserBook.get(userBook.id) ?? { genre: [], mood: [], setting: [] },
			logs: (logsByUserBook.get(userBook.id) ?? [])
				.slice()
				.sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())
				.map((log) => ({
					loggedAt: log.loggedAt,
					pagesRead: log.pagesRead,
					minutesRead: log.minutesRead,
					note: log.note
				}))
		}))
	};

	const filename = `ajar-books-export-${new Date().toISOString().slice(0, 10)}.json`;

	return new Response(JSON.stringify(exportData, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
