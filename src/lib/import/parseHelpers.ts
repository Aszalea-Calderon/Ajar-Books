/**
 * Shared, best-effort field parsers used by every source-specific mapper.
 * Never throw — a field that doesn't parse just comes back null so one bad
 * value doesn't sink the whole row (see the error-report requirement: a
 * malformed field should be noted, not a crash).
 */

export function cleanText(value: string | undefined | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

// Goodreads wraps ISBN/ISBN13 columns as `="0441013597"` so Excel doesn't
// eat leading zeros or treat a long digit string as a number — strip that
// wrapper before treating it as a plain ISBN string.
export function cleanIsbn(value: string | undefined | null): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const unwrapped = trimmed.replace(/^="?(.*?)"?$/, '$1').trim();
	return unwrapped || null;
}

export function parseIntOrNull(value: string | undefined | null): number | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const num = Number.parseInt(trimmed, 10);
	return Number.isFinite(num) ? num : null;
}

export function parseRatingOrNull(value: string | undefined | null): number | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const num = Number.parseFloat(trimmed);
	if (!Number.isFinite(num) || num <= 0) return null;
	return num;
}

// Export dates show up as "YYYY/MM/DD", "YYYY-MM-DD", or occasionally
// "MM/DD/YYYY" depending on the platform/locale — try a small set of known
// shapes rather than a single rigid format.
export function parseDateOrNull(value: string | undefined | null): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;

	const isoLike = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
	if (isoLike) {
		const [, year, month, day] = isoLike;
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		return Number.isNaN(date.getTime()) ? null : date.toISOString();
	}

	const usLike = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (usLike) {
		const [, month, day, year] = usLike;
		const date = new Date(Number(year), Number(month) - 1, Number(day));
		return Number.isNaN(date.getTime()) ? null : date.toISOString();
	}

	return null;
}

// A comma-separated list column (Bookshelves, Tags, Moods, multi-author
// fields) split into trimmed, non-empty entries.
export function splitList(value: string | undefined | null): string[] {
	const trimmed = value?.trim();
	if (!trimmed) return [];
	return trimmed
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

// Title-cases a shelf/tag name pulled from an export ("sci-fi" -> "Sci Fi")
// so imported genres read like the ones typed into the app's own tag editor
// rather than a raw lowercase-hyphenated shelf slug.
export function titleCase(value: string): string {
	return value
		.replace(/[-_]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
}

// StoryGraph's review field is rich text wrapped in raw HTML (<div>, <br>,
// <ul>/<li>, &nbsp;) — reading-log notes are displayed as plain text, not
// rendered HTML, so this strips markup down to readable text instead of
// showing literal tags/entities. Real HTML tags are removed BEFORE entity
// decoding (not after) — StoryGraph users also use an escaped "&lt;spoiler
// &gt;...&lt;/spoiler&gt;" convention to mark spoilers as visible text, and
// decoding those into real "<spoiler>" tags first would make the tag
// stripper incorrectly eat them too.
export function stripHtml(value: string | null): string | null {
	if (!value) return null;

	const withoutTags = value
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(div|p|li)>/gi, '\n')
		.replace(/<[^>]+>/g, '');

	const decoded = withoutTags
		.replace(/&nbsp;/gi, ' ')
		.replace(/&quot;/gi, '"')
		.replace(/&apos;/gi, "'")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&amp;/gi, '&');

	const collapsed = decoded
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/^[ \t]+|[ \t]+$/gm, '')
		.trim();

	return collapsed || null;
}
