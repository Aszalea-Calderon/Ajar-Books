import type { PageServerLoad } from './$types';
import { getLibraryBooks } from '$lib/server/books/library';
import {
	decideUseDecades,
	getBooksFinishedByYear,
	getFictionSplit,
	getGenreBreakdown,
	getMonthlyMetrics,
	getMostReadAuthors,
	getPaceStats,
	getPublicationYearSpread,
	monthKey,
	publicationYearBucketLabel
} from '$lib/server/insights/stats';
import { classifyFiction } from '$lib/server/insights/genreClassification';
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

	// Insights is specifically about books you've actually read — a Want to
	// Read or DNF book shouldn't inflate a genre count or an author's rank
	// just because it's sitting in your library with a tag on it. Scoped to
	// 'finished' only (not 'reading' too) per explicit confirmation
	// 2026-08-22: the strictest reading of "books you have read".
	const readBooks = libraryBooks.filter((entry) => entry.userBook.status === 'finished');

	const genreBreakdown = getGenreBreakdown(readBooks);
	const fictionSplit = getFictionSplit(readBooks);
	const mostReadAuthors = getMostReadAuthors(readBooks);

	const readerTypeSummary = pickReaderTypeSummary(
		computeReaderTypeFacts(genreBreakdown, fictionSplit, paceStats)
	);

	// Same decade-vs-year decision the publication-year chart itself made,
	// so a book can be labeled with the *exact* bucket string its bar
	// represents — recomputing this per-book independently wouldn't work,
	// since the decision depends on the whole library's spread, not any
	// single book's year.
	const publicationYears = readBooks
		.map((entry) => entry.book.publicationYear)
		.filter((year): year is number => year != null);
	const useDecades = decideUseDecades(publicationYears);

	// Trimmed down from the full LibraryBook shape to just what the drill-down
	// panel needs to filter and render — sent to the client once so clicking
	// any chart bar can show its books inline (the real 3D shelf, reused
	// as-is) instead of navigating away to Profile. status/rating/isbn are
	// exactly what ShelfView/Book3D need (shelf-talker badges, real
	// cover-photo fallback), same shape Profile's own shelf view passes.
	// Built from readBooks, not the full library, for the same reason as the
	// stats above — clicking "Romance" should only ever show books you've
	// actually finished and tagged Romance.
	const drillDownBooks = readBooks.map(({ book, userBook, tags }) => ({
		id: book.id,
		title: book.title,
		author: book.author,
		coverUrl: book.coverUrl,
		isbn: book.isbn,
		status: userBook.status,
		rating: userBook.rating,
		genres: tags.genre,
		fictionCategory: classifyFiction(tags.genre),
		finishedYear: userBook.finishedAt ? userBook.finishedAt.getFullYear() : null,
		finishedMonth: userBook.finishedAt ? monthKey(userBook.finishedAt) : null,
		publicationBucket:
			book.publicationYear != null ? publicationYearBucketLabel(book.publicationYear, useDecades) : null
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
