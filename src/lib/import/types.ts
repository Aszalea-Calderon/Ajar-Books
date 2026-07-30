export type ImportStatus = 'want_to_read' | 'reading' | 'finished' | 'dnf';
export type ImportFormat = 'physical' | 'ebook' | 'audiobook';
export type ImportSource = 'goodreads' | 'storygraph' | 'generic';

/**
 * The shape every source-specific parser normalizes its rows into, so the
 * rest of the pipeline (preview, batching, DB writing) only ever deals with
 * one shape regardless of which export it came from.
 */
export type ImportRow = {
	title: string;
	author: string | null;
	isbn: string | null;
	pageCount: number | null;
	publicationYear: number | null;
	status: ImportStatus | null;
	rating: number | null;
	format: ImportFormat | null;
	finishedAt: string | null;
	dateAdded: string | null;
	timesFinished: number | null;
	genres: string[];
	moods: string[];
	note: string | null;
};

export function emptyImportRow(title: string): ImportRow {
	return {
		title,
		author: null,
		isbn: null,
		pageCount: null,
		publicationYear: null,
		status: null,
		rating: null,
		format: null,
		finishedAt: null,
		dateAdded: null,
		timesFinished: null,
		genres: [],
		moods: [],
		note: null
	};
}
