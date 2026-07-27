import { env } from '$env/dynamic/private';
import { getSettings } from '$lib/server/settings';
import { normalizeSubjectsToGenres } from './genreMapping';

const FETCH_TIMEOUT_MS = 8000;

// Open Library/Google Books are third-party services outside our control —
// without a bound, a hung request leaves the user's search or add-book
// action stuck indefinitely instead of failing visibly.
function fetchWithTimeout(url: string | URL): Promise<Response> {
	return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

export type BookSearchResult = {
	title: string;
	author: string | null;
	coverUrl: string | null;
	openLibraryId: string | null;
	isbn: string | null;
	description: string | null;
	pageCount: number | null;
	publicationYear: number | null;
	// Best-effort, pre-add preview only — the real genre tags a book gets once
	// added still come from getOpenLibraryWorkDetails' subjects at add time.
	// Only populated for Open Library results (see searchGoogleBooks).
	genres: string[];
};

type OpenLibraryDoc = {
	key: string;
	title: string;
	author_name?: string[];
	cover_i?: number;
	isbn?: string[];
	number_of_pages_median?: number;
	first_publish_year?: number;
	subject?: string[];
	language?: string[];
};

type OpenLibraryResponse = {
	docs: OpenLibraryDoc[];
};

// Open Library's search index uses MARC/ISO 639-2 (bibliographic) three-letter
// codes, but the rest of the app (Settings UI, Google Books' `volumeInfo`)
// uses two-letter ISO 639-1 — this maps LANGUAGE_PRIORITY_OPTIONS' codes to
// their Open Library equivalent.
const OPEN_LIBRARY_LANGUAGE_CODES: Record<string, string> = {
	en: 'eng',
	es: 'spa',
	fr: 'fre',
	de: 'ger',
	it: 'ita',
	pt: 'por',
	ja: 'jpn',
	zh: 'chi',
	ru: 'rus'
};

async function searchOpenLibrary(
	query: string,
	languagePriority: string
): Promise<BookSearchResult[]> {
	const url = new URL('https://openlibrary.org/search.json');
	url.searchParams.set('q', query);
	url.searchParams.set('limit', '20');
	url.searchParams.set(
		'fields',
		'key,title,author_name,cover_i,isbn,number_of_pages_median,first_publish_year,subject,language'
	);

	const res = await fetchWithTimeout(url);
	if (!res.ok) return [];

	const data: OpenLibraryResponse = await res.json();

	// Search groups results by *work*, not by edition — `language` here is
	// every language any edition of the work has ever been published in, not
	// a promise the returned cover/metadata is in that language. This can
	// only rank a work with a matching-language edition above one with none,
	// not pick which edition's cover/metadata comes back.
	const preferredCode = OPEN_LIBRARY_LANGUAGE_CODES[languagePriority];

	const results = data.docs.map((doc) => ({
		result: {
			title: doc.title,
			author: doc.author_name?.[0] ?? null,
			coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
			openLibraryId: doc.key,
			isbn: doc.isbn?.[0] ?? null,
			// Open Library's search endpoint doesn't include descriptions —
			// fetched separately per-work at add time, see getOpenLibraryWorkDetails.
			description: null,
			pageCount: doc.number_of_pages_median ?? null,
			publicationYear: doc.first_publish_year ?? null,
			genres: normalizeSubjectsToGenres(doc.subject ?? [])
		},
		hasPreferredLanguage: preferredCode ? (doc.language?.includes(preferredCode) ?? false) : true
	}));

	// Stable sort: only reorders matching-language works ahead of the rest,
	// otherwise preserves Open Library's own relevance ranking.
	results.sort((a, b) => Number(b.hasPreferredLanguage) - Number(a.hasPreferredLanguage));

	return results.map((r) => r.result);
}

type GoogleBooksItem = {
	volumeInfo?: {
		title?: string;
		authors?: string[];
		imageLinks?: { thumbnail?: string };
		industryIdentifiers?: { type: string; identifier: string }[];
		description?: string;
		pageCount?: number;
		publishedDate?: string;
		language?: string;
	};
};

type GoogleBooksResponse = {
	items?: GoogleBooksItem[];
};

// Google's publishedDate is "YYYY", "YYYY-MM", or "YYYY-MM-DD" — only the
// leading year is ever needed here.
export function parsePublicationYear(publishedDate?: string): number | null {
	const match = publishedDate?.match(/^\d{4}/);
	return match ? Number(match[0]) : null;
}

async function searchGoogleBooks(
	query: string,
	apiKey: string,
	languagePriority: string
): Promise<BookSearchResult[]> {
	const url = new URL('https://www.googleapis.com/books/v1/volumes');
	url.searchParams.set('q', query);
	url.searchParams.set('maxResults', '20');
	url.searchParams.set('key', apiKey);

	const res = await fetchWithTimeout(url);
	if (!res.ok) return [];

	const data: GoogleBooksResponse = await res.json();

	// Unlike Open Library's work-level search, Google indexes at the edition
	// level — `language` here is a real single value for the exact edition
	// being returned, so this sort is a much stronger signal than the
	// Open Library equivalent.
	const results = (data.items ?? [])
		.filter((item) => item.volumeInfo?.title)
		.map((item) => {
			const info = item.volumeInfo!;
			const isbn =
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ??
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier ??
				null;

			return {
				result: {
					title: info.title!,
					author: info.authors?.[0] ?? null,
					coverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null,
					openLibraryId: null,
					isbn,
					description: info.description ?? null,
					pageCount: info.pageCount ?? null,
					publicationYear: parsePublicationYear(info.publishedDate),
					// Google Books doesn't return bulk subject/category data
					// usable for genre normalization the way Open Library's
					// `subject` field does.
					genres: [] as string[]
				},
				hasPreferredLanguage: info.language === languagePriority
			};
		});

	results.sort((a, b) => Number(b.hasPreferredLanguage) - Number(a.hasPreferredLanguage));

	return results.map((r) => r.result);
}

type OpenLibraryWorkDescription = string | { type: string; value: string };

type OpenLibraryWork = {
	subjects?: string[];
	description?: OpenLibraryWorkDescription;
};

function normalizeOpenLibraryDescription(description?: OpenLibraryWorkDescription): string | null {
	if (!description) return null;
	if (typeof description === 'string') return description;
	return description.value ?? null;
}

const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\(https?:\/\/[^\s)]+\)/g;
// Reference-style links: an inline usage like "([source][1])" or "[source][1]",
// plus the separate "[1]: https://..." definition line it points to.
const REFERENCE_LINK_PATTERN = /\(?\[[^\]]*\]\[[^\]]*\]\)?/g;
const REFERENCE_DEFINITION_PATTERN = /^[ \t]*\[[^\]]+\]:\s*\S+.*$/gm;
const BARE_URL_PATTERN = /https?:\/\/\S+/g;

/**
 * Open Library/Google Books descriptions are real, but user-contributed and
 * occasionally carry spam (e.g. a "[**PDF**](spam-site.com)" link tacked onto
 * an otherwise-legitimate synopsis, or a "([source][1])" reference-style link
 * with its "[1]: https://..." definition elsewhere in the text). Strips
 * link-shaped junk rather than inventing or hiding the underlying
 * description. Always displayed as plain text (never Markdown/HTML) — an
 * embedded link here should never become clickable.
 */
export function sanitizeDescription(description: string | null): string | null {
	if (!description) return null;

	const cleaned = description
		.replace(MARKDOWN_LINK_PATTERN, '')
		.replace(REFERENCE_LINK_PATTERN, '')
		.replace(REFERENCE_DEFINITION_PATTERN, '')
		.replace(BARE_URL_PATTERN, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return cleaned || null;
}

const OPEN_LIBRARY_WORK_ID_PATTERN = /^\/works\/OL\d+W$/;

/**
 * Fetches a work's raw subjects (for genre normalization) and description
 * (for the "About the book" panel). Best-effort: a failure here shouldn't
 * block adding the book, just skip the extra data.
 *
 * Validates the id's shape before using it in an outbound fetch URL — not
 * exploitable today (this only ever runs against our own search results,
 * gated behind auth + CSRF), but Import will introduce externally-sourced
 * ids that could otherwise redirect the fetch to an arbitrary host/path.
 */
export async function getOpenLibraryWorkDetails(
	openLibraryId: string
): Promise<{ subjects: string[]; description: string | null }> {
	if (!OPEN_LIBRARY_WORK_ID_PATTERN.test(openLibraryId)) {
		return { subjects: [], description: null };
	}

	try {
		const res = await fetchWithTimeout(`https://openlibrary.org${openLibraryId}.json`);
		if (!res.ok) return { subjects: [], description: null };
		const data: OpenLibraryWork = await res.json();
		return {
			subjects: data.subjects ?? [],
			description: normalizeOpenLibraryDescription(data.description)
		};
	} catch {
		return { subjects: [], description: null };
	}
}

/**
 * Open Library is always searched (no key required). Google Books is only
 * queried when a Google Books API key is configured (Settings, falling back
 * to GOOGLE_BOOKS_API_KEY), and only contributes results whose ISBN isn't
 * already covered by an Open Library result.
 */
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
	const settings = await getSettings();
	const apiKey = settings.googleBooksApiKey || env.GOOGLE_BOOKS_API_KEY;
	const languagePriority = settings.languagePriority;

	const [openLibraryResults, googleBooksResults] = await Promise.all([
		searchOpenLibrary(query, languagePriority),
		apiKey ? searchGoogleBooks(query, apiKey, languagePriority) : Promise.resolve([])
	]);

	const knownIsbns = new Set(openLibraryResults.map((r) => r.isbn).filter(Boolean));
	const extraResults = googleBooksResults.filter((r) => !r.isbn || !knownIsbns.has(r.isbn));

	return [...openLibraryResults, ...extraResults];
}
