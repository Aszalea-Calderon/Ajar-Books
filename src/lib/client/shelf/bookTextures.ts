import * as THREE from 'three';
import type { BookStatus } from '$lib/bookStatus';

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

export type ShelfBook = {
	id: string;
	title: string;
	author: string | null;
	status: BookStatus;
	rating: number | null;
};

// A shelf-talker sticker, not a design system color — self-contained rather
// than reused from anywhere in app.css, since nothing else in the app
// color-codes status today. 'added' (the transient pre-status marker) gets
// no badge, same as it's never surfaced as a real status elsewhere.
const STATUS_BADGE: Partial<Record<BookStatus, { label: string; color: string }>> = {
	want_to_read: { label: 'Want to Read', color: '#8fb3d6' },
	reading: { label: 'Reading', color: '#d9b464' },
	finished: { label: 'Finished', color: '#8fb08a' },
	dnf: { label: 'DNF', color: '#a8657a' }
};

/**
 * Whether this book has anything for drawCoverBadge/drawSpineBadge to draw.
 * `showStatus: false` (the Insights drill-down shelf, where every book is
 * already known to be finished — the label would be redundant there) means
 * only a rating counts.
 */
export function hasShelfBadge(book: ShelfBook, showStatus = true): boolean {
	return (showStatus && !!STATUS_BADGE[book.status]) || book.rating != null;
}

// A fixed size, not run through fitText's shrink-to-fit — "★ 4.5" is always
// short enough to fit at full size, so there's no need to risk it looking
// smaller on some books than others the way the status label (which
// genuinely can overflow, e.g. "WANT TO READ") does.
const RATING_FONT_SIZE = 22;

// Shrinks (then, as a last resort, truncates with an ellipsis) text to fit
// maxWidth — "Want to Read" in caps is wide enough to run past the cover's
// edge at a fixed size, and there's no fixed font size that's simultaneously
// readable and guaranteed to fit every status label.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string) {
	let fontSize = 22;
	const minFontSize = 15;
	for (; fontSize > minFontSize; fontSize -= 2) {
		ctx.font = `700 ${fontSize}px ${font}`;
		if (ctx.measureText(text).width <= maxWidth) return { text, fontSize };
	}
	ctx.font = `700 ${fontSize}px ${font}`;
	let truncated = text;
	while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
		truncated = truncated.slice(0, -1);
	}
	return { text: truncated.length < text.length ? truncated + '…' : truncated, fontSize };
}

function drawPill(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	height: number,
	paddingX: number,
	label: string,
	fontSize: number,
	font: string,
	textColor: string,
	accentColor?: string
): number {
	ctx.font = `700 ${fontSize}px ${font}`;
	const width = ctx.measureText(label).width + paddingX * 2;

	ctx.fillStyle = 'rgba(0,0,0,0.55)';
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, 6);
	ctx.fill();
	if (accentColor) {
		ctx.fillStyle = accentColor;
		ctx.fillRect(x, y, 4, height);
	}

	ctx.fillStyle = textColor;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, x + paddingX, y + height / 2 + 1);

	return width;
}

/**
 * Corner stickers on the cover face: a status pill and, below it (or alone,
 * at the top, if there's no status pill), a star rating pill — both
 * top-left and stacked rather than side-by-side, since a long label like
 * "WANT TO READ" plus a rating wouldn't both fit on one row. Drawn over
 * whatever art is already on the canvas — the procedural gradient, or (via
 * compositeCoverBadge below) a real loaded cover photo.
 */
function drawCoverBadge(ctx: CanvasRenderingContext2D, canvasWidth: number, book: ShelfBook, showStatus = true) {
	const font = bodyFont();
	const pillHeight = 34;
	const paddingX = 14;
	const margin = 24;
	const maxWidth = canvasWidth - margin * 2;
	let nextY = margin;

	const statusInfo = showStatus ? STATUS_BADGE[book.status] : undefined;
	if (statusInfo) {
		const { text, fontSize } = fitText(ctx, statusInfo.label.toUpperCase(), maxWidth, font);
		drawPill(ctx, margin, nextY, pillHeight, paddingX, text, fontSize, font, '#f4f2ec', statusInfo.color);
		nextY += pillHeight + 8;
	}

	if (book.rating != null) {
		drawPill(ctx, margin, nextY, pillHeight, paddingX, `★ ${book.rating}`, RATING_FONT_SIZE, font, '#f2c14e');
	}
}

/**
 * The spine equivalent — far less room (128px wide, and the title text
 * already claims most of the rotated column), so this is deliberately just
 * a small color dot near the top (status) and a compact star rating near
 * the bottom, rather than trying to fit a labeled pill.
 */
function drawSpineBadge(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, book: ShelfBook, showStatus = true) {
	const statusInfo = showStatus ? STATUS_BADGE[book.status] : undefined;
	if (statusInfo) {
		ctx.fillStyle = statusInfo.color;
		ctx.beginPath();
		ctx.arc(canvas.width / 2, 40, 10, 0, Math.PI * 2);
		ctx.fill();
	}

	if (book.rating != null) {
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height - 40);
		ctx.rotate(-Math.PI / 2);
		ctx.font = `700 20px ${bodyFont()}`;
		ctx.fillStyle = '#f2c14e';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`★ ${book.rating}`, 0, 0);
		ctx.restore();
	}
}

/** 512×768 generated front-cover texture: base color, title, author. */
export function makeProceduralCover(book: ShelfBook, showStatus = true): THREE.Texture {
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

	drawCoverBadge(ctx, canvas.width, book, showStatus);

	return finishTexture(canvas);
}

/** 128×768 generated spine texture, applied to every book's side faces (no data source has real spine art). */
export function makeProceduralSpine(book: ShelfBook, showStatus = true): THREE.Texture {
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

	drawSpineBadge(ctx, canvas, book, showStatus);

	return finishTexture(canvas);
}

const proceduralCache = new Map<string, { cover: THREE.Texture; spine: THREE.Texture }>();

// Keyed on showStatus too — the same book can appear both on Profile's
// shelf (status badge shown) and the Insights drill-down shelf (status
// badge suppressed, see hasShelfBadge's doc comment); without this a
// texture generated for one context would wrongly get reused in the other.
export function proceduralTexturesFor(book: ShelfBook, showStatus = true) {
	const cacheKey = `${book.id}:${showStatus ? 's' : 'ns'}`;
	const cached = proceduralCache.get(cacheKey);
	if (cached) return cached;
	const entry = { cover: makeProceduralCover(book, showStatus), spine: makeProceduralSpine(book, showStatus) };
	proceduralCache.set(cacheKey, entry);
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

/**
 * A real loaded cover photo replaces coverMaterial.map outright (see
 * Book3D.svelte) — badges baked into the *procedural* cover would vanish
 * the moment a real one loads, since it's a different texture entirely.
 * This redraws the loaded photo onto a fresh canvas with the same badges
 * painted on top, so the sticker survives the swap. Only called when
 * there's actually a badge to draw (see hasShelfBadge) — otherwise the real
 * texture is used as-is, same as before this feature existed.
 */
export function compositeCoverBadge(image: HTMLImageElement, book: ShelfBook, showStatus = true): THREE.Texture {
	const naturalWidth = image.naturalWidth || image.width || 512;
	const naturalHeight = image.naturalHeight || image.height || 768;
	// drawCoverBadge's margins/pill sizes are absolute pixels, sized for a
	// cover in the ~512px-wide range. Some import sources (Goodreads/
	// StoryGraph CSV exports) store tiny thumbnail URLs — as narrow as
	// ~50-100px — and compositing straight onto a canvas that small leaves
	// almost no room for the badge, forcing fitText's truncation fallback
	// down to a single character. Upscaling the canvas to a consistent
	// minimum width keeps badge text legible regardless of the source
	// image's real resolution.
	const MIN_WIDTH = 512;
	const scale = naturalWidth < MIN_WIDTH ? MIN_WIDTH / naturalWidth : 1;
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(naturalWidth * scale);
	canvas.height = Math.round(naturalHeight * scale);
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
	drawCoverBadge(ctx, canvas.width, book, showStatus);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.generateMipmaps = true;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.needsUpdate = true;
	return texture;
}
