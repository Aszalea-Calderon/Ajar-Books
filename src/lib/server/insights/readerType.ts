import type { FictionSplit, GenreCount, PaceStats } from './stats';

export type FictionLeaning = 'fiction' | 'nonfiction' | 'mixed';

export type ReaderTypeFacts = {
	dominantGenre: string | null;
	fictionLeaning: FictionLeaning | null;
	pace: PaceStats;
};

/**
 * Distills the raw stats into the handful of facts the summary templates
 * below actually reason about. `fictionLeaning` needs a real majority (65%)
 * either way to call it "fiction" or "nonfiction" — a near-even split reads
 * as "mixed" rather than picking a side arbitrarily.
 */
export function computeReaderTypeFacts(
	genreBreakdown: GenreCount[],
	fictionSplit: FictionSplit,
	pace: PaceStats
): ReaderTypeFacts {
	const dominantGenre = genreBreakdown[0]?.genre ?? null;
	const total = fictionSplit.fiction + fictionSplit.nonfiction + fictionSplit.unclassified;

	let fictionLeaning: FictionLeaning | null = null;
	if (total > 0) {
		const fictionRatio = fictionSplit.fiction / total;
		const nonfictionRatio = fictionSplit.nonfiction / total;
		if (fictionRatio >= 0.65) fictionLeaning = 'fiction';
		else if (nonfictionRatio >= 0.65) fictionLeaning = 'nonfiction';
		else fictionLeaning = 'mixed';
	}

	return { dominantGenre, fictionLeaning, pace };
}

function formatDays(days: number): string {
	if (days < 1) return 'under a day';
	if (Math.round(days) === 1) return '1 day';
	return `${Math.round(days)} days`;
}

function leaningAdjective(leaning: FictionLeaning): string {
	if (leaning === 'mixed') return 'wide-ranging';
	return leaning;
}

// Each template only fires when every fact it references is available —
// deliberately several small, narrow templates rather than one big one
// with fallback clauses, so a sparse library (no pace data yet, say) still
// gets a real sentence from whichever templates its facts do satisfy,
// instead of everything degrading to the same generic line.
type Template = (facts: ReaderTypeFacts) => string | null;

const TEMPLATES: Template[] = [
	(f) =>
		f.dominantGenre && f.fictionLeaning
			? `You're a ${leaningAdjective(f.fictionLeaning)} reader with a real soft spot for ${f.dominantGenre}.`
			: null,
	(f) =>
		f.dominantGenre && f.pace.averageDaysPerBook != null
			? `A ${f.dominantGenre} devotee — you finish a book every ${formatDays(f.pace.averageDaysPerBook)} on average.`
			: null,
	(f) =>
		f.pace.pagesPerActiveDay != null && f.pace.averageDaysPerBook != null
			? `When you're in a book, you read about ${f.pace.pagesPerActiveDay} pages a day — enough to finish one roughly every ${formatDays(f.pace.averageDaysPerBook)}.`
			: null,
	(f) =>
		f.fictionLeaning === 'fiction' && f.dominantGenre
			? `Fiction is clearly home base for you, especially ${f.dominantGenre}.`
			: null,
	(f) =>
		f.fictionLeaning === 'nonfiction' && f.dominantGenre
			? `You gravitate toward nonfiction, especially ${f.dominantGenre} — a reader who reads to learn.`
			: null,
	(f) =>
		f.fictionLeaning === 'mixed' && f.dominantGenre
			? `You read widely across fiction and nonfiction, with ${f.dominantGenre} coming up the most.`
			: null,
	(f) => (f.dominantGenre ? `${f.dominantGenre} is your most-read genre so far.` : null),
	(f) =>
		f.pace.pagesPerActiveDay != null
			? `On a day you pick up a book, you read about ${f.pace.pagesPerActiveDay} pages.`
			: null
];

const FALLBACK = 'Log a bit more reading to start seeing your reader type here.';

/**
 * Picks one of whichever templates the given facts satisfy — `random`
 * defaults to Math.random but is injectable so a test can assert against a
 * specific variant instead of "one of N strings."
 */
export function pickReaderTypeSummary(facts: ReaderTypeFacts, random: () => number = Math.random): string {
	const candidates = TEMPLATES.map((template) => template(facts)).filter(
		(text): text is string => text !== null
	);
	if (candidates.length === 0) return FALLBACK;
	return candidates[Math.floor(random() * candidates.length)];
}
