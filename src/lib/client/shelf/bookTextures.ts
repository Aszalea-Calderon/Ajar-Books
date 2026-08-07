import * as THREE from 'three';

// Curated palette, not raw-random hue — a random HSL roll produces neon
// garbage that looks nothing like a book. Deep, book-cover-plausible tones.
const PALETTE = [
	'#1f3a5f', // navy
	'#5f1f2a', // oxblood
	'#2a4a3a', // forest
	'#8a6a1f', // mustard
	'#3a3f4a', // slate
	'#4a2a4a', // plum
	'#7a3a2a', // terracotta
	'#1f4a4a' // teal
];

function hashString(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

// Keyed on the book's stable id, not its title — a retitled book keeps its color.
function paletteFor(bookId: string): string {
	return PALETTE[hashString(bookId) % PALETTE.length];
}

function bodyFont(): string {
	if (typeof document === 'undefined') return 'sans-serif';
	const value = getComputedStyle(document.documentElement).getPropertyValue('--font-body');
	return value.trim() || 'sans-serif';
}

function wrapLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number
): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let current = '';

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (ctx.measureText(candidate).width > maxWidth && current) {
			lines.push(current);
			current = word;
			if (lines.length === maxLines - 1) break;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);

	if (lines.length > maxLines) lines.length = maxLines;
	const last = lines[lines.length - 1];
	if (last && ctx.measureText(last).width > maxWidth) {
		while (lines[lines.length - 1] && ctx.measureText(lines[lines.length - 1] + '…').width > maxWidth) {
			lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
		}
		lines[lines.length - 1] += '…';
	}
	return lines;
}

function finishTexture(canvas: HTMLCanvasElement): THREE.Texture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}

export type ShelfBook = { id: string; title: string; author: string | null };

/** 512×768 generated front-cover texture: base color, title, author. */
export function makeProceduralCover(book: ShelfBook): THREE.Texture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 768;
	const ctx = canvas.getContext('2d')!;
	const color = paletteFor(book.id);

	const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, '#000000');
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.globalAlpha = 0.35;
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.globalAlpha = 1;

	ctx.strokeStyle = 'rgba(255,255,255,0.35)';
	ctx.lineWidth = 4;
	ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

	const font = bodyFont();
	ctx.fillStyle = '#f4f2ec';
	ctx.textAlign = 'center';
	ctx.font = `700 44px ${font}`;
	const titleLines = wrapLines(ctx, book.title, canvas.width - 100, 4);
	const titleStartY = canvas.height * 0.4;
	titleLines.forEach((line, i) => {
		ctx.fillText(line, canvas.width / 2, titleStartY + i * 52);
	});

	if (book.author) {
		ctx.font = `400 28px ${font}`;
		ctx.fillStyle = 'rgba(244,242,236,0.85)';
		ctx.fillText(book.author, canvas.width / 2, canvas.height - 80);
	}

	return finishTexture(canvas);
}

/** 128×768 generated spine texture, applied to every book's side faces (no data source has real spine art). */
export function makeProceduralSpine(book: ShelfBook): THREE.Texture {
	const canvas = document.createElement('canvas');
	canvas.width = 128;
	canvas.height = 768;
	const ctx = canvas.getContext('2d')!;
	const color = paletteFor(book.id);

	ctx.fillStyle = color;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.strokeStyle = 'rgba(255,255,255,0.25)';
	ctx.lineWidth = 3;
	ctx.strokeRect(10, 20, canvas.width - 20, canvas.height - 40);

	ctx.save();
	ctx.translate(canvas.width / 2, canvas.height / 2);
	ctx.rotate(-Math.PI / 2);
	ctx.fillStyle = '#f4f2ec';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = `700 34px ${bodyFont()}`;
	const label = book.title.length > 40 ? book.title.slice(0, 39) + '…' : book.title;
	ctx.fillText(label, 0, 0, canvas.height - 80);
	ctx.restore();

	return finishTexture(canvas);
}

const proceduralCache = new Map<string, { cover: THREE.Texture; spine: THREE.Texture }>();

export function proceduralTexturesFor(book: ShelfBook) {
	const cached = proceduralCache.get(book.id);
	if (cached) return cached;
	const entry = { cover: makeProceduralCover(book), spine: makeProceduralSpine(book) };
	proceduralCache.set(book.id, entry);
	return entry;
}

// A real ISBN-10/13 is digits only (ISBN-10's check digit can be 'X'). Some
// import sources (confirmed: StoryGraph exports) put an Amazon ASIN in the
// same column for ebooks instead — e.g. "B0BZZTHJCS" — which looks
// isbn-shaped enough to be tempting to use, but will never resolve via
// Open Library's isbn-keyed cover endpoint. Filtering these out here avoids
// a request that's guaranteed to only hit the "no cover" placeholder.
const ISBN_PATTERN = /^(?:\d{9}[\dXx]|\d{13})$/;

/**
 * CSV-imported books never get a `coverUrl` fetched at import time (unlike
 * books added via Search), even though most carry a real ISBN — this
 * constructs the same Open Library cover URL Search already uses, so
 * imported books get real art too instead of always falling to the
 * procedural cover. Returns null when there's nothing to try.
 */
export function resolveCoverUrl(book: { coverUrl: string | null; isbn: string | null }): string | null {
	if (book.coverUrl) return book.coverUrl;
	if (book.isbn && ISBN_PATTERN.test(book.isbn)) {
		return `https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`;
	}
	return null;
}

const remoteCache = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();

/** Loads a real cover through the same-origin proxy (`/covers?url=`), deduped and cached per URL. */
export function loadCoverTexture(coverUrl: string): Promise<THREE.Texture> {
	const cached = remoteCache.get(coverUrl);
	if (cached) return cached;

	const proxied = `/covers?url=${encodeURIComponent(coverUrl)}`;
	const promise = loader.loadAsync(proxied).then((texture) => {
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.generateMipmaps = true;
		texture.minFilter = THREE.LinearMipmapLinearFilter;
		return texture;
	});
	remoteCache.set(coverUrl, promise);
	return promise;
}
