import type { PageServerLoad } from './$types';
import { getLibraryBooks } from '$lib/server/books/library';
import {
	getBooksFinishedByYear,
	getFictionSplit,
	getGenreBreakdown,
	getMonthlyMetrics,
	getMostReadAuthors,
	getPaceStats,
	getPublicationYearSpread
} from '$lib/server/insights/stats';
import { computeReaderTypeFacts, pickReaderTypeSummary } from '$lib/server/insights/readerType';

export const load: PageServerLoad = async () => {
	// One fetch of the full library feeds genre/fiction/author stats, rather
	// than each querying it independently (they used to, redundantly).
	const [libraryBooks, booksFinishedByYear, monthlyMetrics, publicationYearSpread, paceStats] =
		await Promise.all([
			getLibraryBooks(),
			getBooksFinishedByYear(),
			getMonthlyMetrics(6),
			getPublicationYearSpread(),
			getPaceStats()
		]);

	const genreBreakdown = getGenreBreakdown(libraryBooks);
	const fictionSplit = getFictionSplit(libraryBooks);
	const mostReadAuthors = getMostReadAuthors(libraryBooks);

	const readerTypeSummary = pickReaderTypeSummary(
		computeReaderTypeFacts(genreBreakdown, fictionSplit, paceStats)
	);

	// Trimmed down from the full LibraryBook shape to just what the drill-down
	// panel needs to filter and render — sent to the client once so clicking
	// a genre/author bar can show its books inline (the real 3D shelf,
	// reused as-is) instead of navigating away to Profile. status/rating/isbn
	// are exactly what ShelfView/Book3D need (shelf-talker badges, real
	// cover-photo fallback), same shape Profile's own shelf view passes.
	const drillDownBooks = libraryBooks.map(({ book, userBook, tags }) => ({
		id: book.id,
		title: book.title,
		author: book.author,
		coverUrl: book.coverUrl,
		isbn: book.isbn,
		status: userBook.status,
		rating: userBook.rating,
		genres: tags.genre
	}));

	return {
		genreBreakdown,
		fictionSplit,
		booksFinishedByYear,
		monthlyMetrics,
		publicationYearSpread,
		mostReadAuthors,
		paceStats,
		readerTypeSummary,
		drillDownBooks
	};
};
