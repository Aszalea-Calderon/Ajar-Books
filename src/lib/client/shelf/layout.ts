// Pure shelf geometry/virtualization math — no Three.js/Threlte imports, so
// this stays unit-testable like the rest of $lib's pure modules (date.ts,
// goalPace.ts, streak.ts).

export const BOOK_WIDTH = 0.16;
export const BOOK_HEIGHT = 0.24;
export const BOOK_DEPTH = 0.035;
export const ROW_PITCH = 0.34;

// Face-out (covers toward camera) needs cover-width spacing; spine-out
// (spines toward camera) needs only spine-depth spacing — a real shelf
// packs far more books per row in that orientation, same as a real library.
export const COVER_COLUMN_PITCH = 0.2;
export const SPINE_COLUMN_PITCH = BOOK_DEPTH + 0.015;

export type ShelfOrientation = 'cover' | 'spine';

function columnPitchFor(orientation: ShelfOrientation): number {
	return orientation === 'spine' ? SPINE_COLUMN_PITCH : COVER_COLUMN_PITCH;
}

const TILT_MAX_RAD = (2 * Math.PI) / 180; // ±2°, just enough to avoid a flat texture-atlas look

/** Column count for a given canvas width, clamped to a sane display range per orientation. */
export function columnsFor(widthPx: number, orientation: ShelfOrientation = 'cover'): number {
	if (orientation === 'spine') {
		return Math.min(20, Math.max(6, Math.round(widthPx / 55)));
	}
	return Math.min(8, Math.max(3, Math.round(widthPx / 190)));
}

// Deterministic [0, 1) pseudo-random from a book's stable id — the same
// book always jitters/tilts the same way across renders and scroll
// positions, rather than reshuffling every time its row remounts.
function seededUnit(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	}
	return (Math.abs(hash) % 1000) / 1000;
}

export type ShelfPosition = { x: number; y: number; z: number; tilt: number };

export function positionFor(
	index: number,
	columns: number,
	seed: string,
	orientation: ShelfOrientation = 'cover'
): ShelfPosition {
	const col = index % columns;
	const row = Math.floor(index / columns);
	const jitter = seededUnit(seed);
	return {
		x: (col - (columns - 1) / 2) * columnPitchFor(orientation),
		y: -row * ROW_PITCH,
		z: (jitter - 0.5) * 0.02,
		tilt: (jitter * 2 - 1) * TILT_MAX_RAD
	};
}

export function rowCountFor(totalBooks: number, columns: number): number {
	return columns > 0 ? Math.ceil(totalBooks / columns) : 0;
}

export type VisibleRowRange = { startRow: number; endRow: number };

/**
 * Rows within [firstVisibleRow - buffer, lastVisibleRow + buffer], clamped
 * to the real row count. Driven by the *target* scroll offset (not the
 * eased current one) so meshes exist a frame before they're needed.
 */
export function visibleRowRange(
	scrollRows: number,
	viewportRows: number,
	totalRows: number,
	buffer = 1
): VisibleRowRange {
	if (totalRows <= 0) return { startRow: 0, endRow: -1 };
	const first = Math.floor(scrollRows) - buffer;
	const last = Math.ceil(scrollRows + viewportRows) + buffer;
	return {
		startRow: Math.max(0, first),
		endRow: Math.min(totalRows - 1, last)
	};
}

/** Flat book indices covered by a row range, for `{#each}`-ing only the visible slice. */
export function visibleIndices(range: VisibleRowRange, columns: number, totalBooks: number): number[] {
	const indices: number[] = [];
	for (let row = range.startRow; row <= range.endRow; row++) {
		for (let col = 0; col < columns; col++) {
			const index = row * columns + col;
			if (index < totalBooks) indices.push(index);
		}
	}
	return indices;
}
