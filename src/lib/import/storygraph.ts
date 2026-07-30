import type { ImportRow, ImportStatus, ImportFormat } from './types';
import {
	cleanText,
	cleanIsbn,
	parseIntOrNull,
	parseRatingOrNull,
	parseDateOrNull,
	splitList,
	titleCase,
	stripHtml
} from './parseHelpers';

// "Read Status" and "Moods" together are distinctive to a StoryGraph
// export — no other common platform pairs those two exact column names.
const STORYGRAPH_FINGERPRINT = ['Read Status', 'Moods'];

export function looksLikeStoryGraph(headers: string[]): boolean {
	const set = new Set(headers.map((h) => h.trim()));
	return STORYGRAPH_FINGERPRINT.every((h) => set.has(h));
}

const READ_STATUS: Record<string, ImportStatus> = {
	read: 'finished',
	'currently-reading': 'reading',
	'to-read': 'want_to_read',
	'did-not-finish': 'dnf'
};

// StoryGraph's real export values are "digital"/"audio" (confirmed against
// an actual export) — "ebook"/"audiobook"/"physical book" are kept too in
// case a different export version or locale uses them instead.
const FORMAT_MAP: Record<string, ImportFormat> = {
	digital: 'ebook',
	ebook: 'ebook',
	audio: 'audiobook',
	audiobook: 'audiobook',
	'physical book': 'physical',
	hardcover: 'physical',
	paperback: 'physical'
};

export function mapStoryGraphRow(row: Record<string, string>): ImportRow {
	const title = cleanText(row['Title']) ?? '';
	// StoryGraph lists every author/contributor comma-separated — only the
	// first is kept, matching how a single "author" field is used everywhere
	// else in this app.
	const authors = splitList(row['Authors']);
	const readStatus = cleanText(row['Read Status'])?.toLowerCase() ?? null;
	const format = cleanText(row['Format'])?.toLowerCase() ?? null;

	return {
		title,
		author: authors[0] ?? null,
		isbn: cleanIsbn(row['ISBN/UID']),
		pageCount: parseIntOrNull(row['Pages'] ?? row['Page Count']),
		publicationYear: parseIntOrNull(row['Publication Year']),
		status: (readStatus && READ_STATUS[readStatus]) || null,
		rating: parseRatingOrNull(row['Star Rating']),
		format: (format && FORMAT_MAP[format]) || null,
		finishedAt: parseDateOrNull(row['Last Date Read']),
		dateAdded: parseDateOrNull(row['Date Added']),
		timesFinished: parseIntOrNull(row['Read Count']),
		genres: splitList(row['Tags']).map(titleCase),
		moods: splitList(row['Moods']).map(titleCase),
		// StoryGraph's review field is rich text wrapped in raw HTML
		// (<div>...&nbsp;</div>, occasionally <ul><li> lists) — stripped down
		// to plain text since reading-log notes are displayed as-is, not
		// rendered as HTML.
		note: stripHtml(cleanText(row['Review']))
	};
}
