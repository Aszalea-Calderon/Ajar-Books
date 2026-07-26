import { env } from '$env/dynamic/private';
import { getSettings } from '$lib/server/settings';

export type BookSearchResult = {
	title: string;
	author: string | null;
	coverUrl: string | null;
	openLibraryId: string | null;
	isbn: string | null;
	description: string | null;
	pageCount: number | null;
};

type OpenLibraryDoc = {
	key: string;
	title: string;
	author_name?: string[];
	cover_i?: number;
	isbn?: string[];
	number_of_pages_median?: number;
};

type OpenLibraryResponse = {
	docs: OpenLibraryDoc[];
};

async function searchOpenLibrary(query: string): Promise<BookSearchResult[]> {
	const url = new URL('https://openlibrary.org/search.json');
	url.searchParams.set('q', query);
	url.searchParams.set('limit', '20');
	url.searchParams.set('fields', 'key,title,author_name,cover_i,isbn,number_of_pages_median');

	const res = await fetch(url);
	if (!res.ok) return [];

	const data: OpenLibraryResponse = await res.json();

	return data.docs.map((doc) => ({
		title: doc.title,
		author: doc.author_name?.[0] ?? null,
		coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
		openLibraryId: doc.key,
		isbn: doc.isbn?.[0] ?? null,
		// Open Library's search endpoint doesn't include descriptions — fetched
		// separately per-work at add time, see getOpenLibraryWorkDetails.
		description: null,
		pageCount: doc.number_of_pages_median ?? null
	}));
}

type GoogleBooksItem = {
	volumeInfo?: {
		title?: string;
		authors?: string[];
		imageLinks?: { thumbnail?: string };
		industryIdentifiers?: { type: string; identifier: string }[];
		description?: string;
		pageCount?: number;
	};
};

type GoogleBooksResponse = {
	items?: GoogleBooksItem[];
};

async function searchGoogleBooks(query: string, apiKey: string): Promise<BookSearchResult[]> {
	const url = new URL('https://www.googleapis.com/books/v1/volumes');
	url.searchParams.set('q', query);
	url.searchParams.set('maxResults', '20');
	url.searchParams.set('key', apiKey);

	const res = await fetch(url);
	if (!res.ok) return [];

	const data: GoogleBooksResponse = await res.json();

	return (data.items ?? [])
		.filter((item) => item.volumeInfo?.title)
		.map((item) => {
			const info = item.volumeInfo!;
			const isbn =
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ??
				info.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier ??
				null;

			return {
				title: info.title!,
				author: info.authors?.[0] ?? null,
				coverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? null,
				openLibraryId: null,
				isbn,
				description: info.description ?? null,
				pageCount: info.pageCount ?? null
			};
		});
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
		const res = await fetch(`https://openlibrary.org${openLibraryId}.json`);
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

	const [openLibraryResults, googleBooksResults] = await Promise.all([
		searchOpenLibrary(query),
		apiKey ? searchGoogleBooks(query, apiKey) : Promise.resolve([])
	]);

	const knownIsbns = new Set(openLibraryResults.map((r) => r.isbn).filter(Boolean));
	const extraResults = googleBooksResults.filter((r) => !r.isbn || !knownIsbns.has(r.isbn));

	return [...openLibraryResults, ...extraResults];
}
