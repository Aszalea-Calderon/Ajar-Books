import type { PageServerLoad } from './$types';
import {
	getBooksFinishedByYear,
	getFictionSplit,
	getGenreBreakdown,
	getMonthlyMetrics
} from '$lib/server/insights/stats';

export const load: PageServerLoad = async () => {
	const [genreBreakdown, fictionSplit, booksFinishedByYear, monthlyMetrics] = await Promise.all([
		getGenreBreakdown(),
		getFictionSplit(),
		getBooksFinishedByYear(),
		getMonthlyMetrics(6)
	]);

	return { genreBreakdown, fictionSplit, booksFinishedByYear, monthlyMetrics };
};
