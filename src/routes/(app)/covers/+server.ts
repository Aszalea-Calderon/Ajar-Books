import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cross-origin cover images need CORS headers to be usable as WebGL
// textures (the 3D shelf view) — Open Library sends them, Google Books
// does not, so both need to be loaded through this same-origin proxy
// rather than directly. Also closes an open-fetch-proxy/SSRF hole: this
// app is self-hostable, so an unrestricted `?url=` passthrough would let
// a logged-in session make the server fetch arbitrary internal URLs.
const ALLOWED_HOSTS = new Set([
	'covers.openlibrary.org',
	'books.google.com',
	'books.googleusercontent.com'
]);

const FETCH_TIMEOUT_MS = 8000;

// Open Library's cover-by-isbn/id endpoints don't 404 when there's no cover
// on file — they return a tiny placeholder image (a 1x1 GIF, 43 bytes) with
// a normal 200. Left alone, that renders as a solid black book face instead
// of falling back to our own procedural cover. A real -M size cover is
// reliably tens of KB, so a small byte-size cutoff tells the two apart
// without needing to know Open Library's exact placeholder.
//
// This has to check the *actual downloaded bytes*, not the Content-Length
// header — confirmed live that Open Library serves this placeholder over
// HTTP/2 without a Content-Length header at all, which silently no-ops a
// header-only check and lets the black placeholder straight through.
const MIN_REAL_COVER_BYTES = 3000;

export const GET: RequestHandler = async ({ url, fetch }) => {
	const target = url.searchParams.get('url');
	if (!target) error(400, 'Missing url');

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		error(400, 'Invalid url');
	}

	if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
		error(400, 'Host not allowed');
	}

	const upstream = await fetch(parsed, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(
		() => null
	);
	if (!upstream || !upstream.ok || !upstream.body) {
		error(502, 'Cover unavailable');
	}

	const bytes = new Uint8Array(await upstream.arrayBuffer());
	if (bytes.byteLength < MIN_REAL_COVER_BYTES) {
		error(404, 'No real cover for this book');
	}

	return new Response(bytes, {
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
			'Cache-Control': 'public, max-age=604800, immutable'
		}
	});
};
