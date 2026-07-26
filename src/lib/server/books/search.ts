import { env } from '$env/dynamic/private';
import { getSettings } from '$lib/server/settings';

export type BookSearchResult = {
	title: string;
	author: string | null;
	coverUrl: string | null;
	openLibraryId: string | null;
	isbn: string | null;
};

type OpenLibraryDoc = {
	key: string;
	title: string;
	author_name?: string[];
	cover_i?: number;
	isbn?: string[];
};

type OpenLibraryResponse = {
	docs: OpenLibraryDoc[];
};

async function searchOpenLibrary(query: string): Promise<BookSearchResult[]> {
	const url = new URL('https://openlibrary.org/search.json');
	url.searchParams.set('q', query);
	url.searchParams.set('limit', '20');
	url.searchParams.set('fields', 'key,title,author_name,cover_i,isbn');

	const res = await fetch(url);
	if (!res.ok) return [];

	const data: OpenLibraryResponse = await res.json();

	return data.docs.map((doc) => ({
		title: doc.title,
		author: doc.author_name?.[0] ?? null,
		coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
		openLibraryId: doc.key,
		isbn: doc.isbn?.[0] ?? null
	}));
}

type GoogleBooksItem = {
	volumeInfo?: {
		title?: string;
		authors?: string[];
		imageLinks?: { thumbnail?: string };
		industryIdentifiers?: { type: string; identifier: string }[];
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
				isbn
			};
		});
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
