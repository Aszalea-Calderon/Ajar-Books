/**
 * Curated genre-normalization table: Open Library's raw `subjects` are messy
 * and inconsistent ("Science fiction, American", "Fiction, fantasy, epic",
 * "American fiction -- 21st century" ...). Matching by keyword rather than
 * exact string is what makes this hold up against that long tail — exact-match
 * would miss almost everything. Expect to extend SPECIFIC_GENRE_RULES over
 * time as new subjects show up that don't map to anything yet.
 */
type GenreRule = { genre: string; keywords: string[] };

const SPECIFIC_GENRE_RULES: GenreRule[] = [
	{ genre: 'Fantasy', keywords: ['fantasy'] },
	{ genre: 'Science Fiction', keywords: ['science fiction', 'sci-fi', 'dystopia'] },
	{ genre: 'Mystery', keywords: ['mystery', 'detective', 'crime fiction'] },
	{ genre: 'Thriller', keywords: ['thriller', 'suspense'] },
	{ genre: 'Romance', keywords: ['romance', 'love stories'] },
	{ genre: 'Horror', keywords: ['horror', 'occult fiction'] },
	{ genre: 'Historical Fiction', keywords: ['historical fiction'] },
	{ genre: 'Memoir', keywords: ['biography', 'autobiography', 'memoir'] },
	{ genre: 'History', keywords: ['history', 'historical event'] },
	{ genre: 'Poetry', keywords: ['poetry', 'poems'] },
	{ genre: 'Young Adult', keywords: ['young adult fiction', 'juvenile fiction'] },
	{ genre: 'Graphic Novel', keywords: ['comics', 'graphic novel', 'comic books'] },
	{ genre: 'Self-Help', keywords: ['self-help', 'self help'] },
	{ genre: 'Business', keywords: ['business', 'management'] },
	{ genre: 'Science', keywords: ['popular science'] },
	{ genre: 'Literary Fiction', keywords: ['literary fiction'] },
	{ genre: 'Classics', keywords: ['classics'] }
];

const FALLBACK_GENRE_RULES: GenreRule[] = [
	{ genre: 'Fiction', keywords: ['fiction'] },
	{ genre: 'Nonfiction', keywords: ['nonfiction', 'non-fiction'] }
];

export const CANONICAL_GENRES = [
	...new Set([...SPECIFIC_GENRE_RULES, ...FALLBACK_GENRE_RULES].map((r) => r.genre))
];

/**
 * Only falls back to the broad Fiction/Nonfiction buckets when nothing more
 * specific matched, so a book doesn't end up tagged both "Fantasy" and the
 * much less useful "Fiction".
 */
export function normalizeSubjectsToGenres(subjects: string[]): string[] {
	const lowerSubjects = subjects.map((s) => s.toLowerCase());
	const matched = new Set<string>();

	for (const rule of SPECIFIC_GENRE_RULES) {
		if (lowerSubjects.some((s) => rule.keywords.some((kw) => s.includes(kw)))) {
			matched.add(rule.genre);
		}
	}

	if (matched.size === 0) {
		for (const rule of FALLBACK_GENRE_RULES) {
			if (lowerSubjects.some((s) => rule.keywords.some((kw) => s.includes(kw)))) {
				matched.add(rule.genre);
			}
		}
	}

	return [...matched];
}
