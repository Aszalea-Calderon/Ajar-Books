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

	return {
		genreBreakdown,
		fictionSplit,
		booksFinishedByYear,
		monthlyMetrics,
		publicationYearSpread,
		mostReadAuthors,
		paceStats,
		readerTypeSummary
	};
};
