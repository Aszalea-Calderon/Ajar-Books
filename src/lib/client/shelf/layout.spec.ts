import { describe, expect, it } from 'vitest';
import {
	columnsFor,
	positionFor,
	rowCountFor,
	visibleRowRange,
	visibleIndices,
	COVER_COLUMN_PITCH,
	SPINE_COLUMN_PITCH,
	ROW_PITCH
} from './layout';

describe('columnsFor', () => {
	it('clamps to a minimum of 3 columns on a narrow viewport', () => {
		expect(columnsFor(300)).toBe(3);
	});

	it('clamps to a maximum of 8 columns on a very wide viewport', () => {
		expect(columnsFor(3000)).toBe(8);
	});

	it('scales roughly with width in between', () => {
		expect(columnsFor(950)).toBe(5);
	});

	it('fits far more columns in spine orientation than cover orientation, same width', () => {
		expect(columnsFor(1200, 'spine')).toBeGreaterThan(columnsFor(1200, 'cover'));
	});

	it('clamps spine orientation to a minimum of 6 and maximum of 20 columns', () => {
		expect(columnsFor(100, 'spine')).toBe(6);
		expect(columnsFor(5000, 'spine')).toBe(20);
	});
});

describe('positionFor', () => {
	it('lays out the first row left-to-right, centered around x=0', () => {
		const columns = 4;
		const positions = [0, 1, 2, 3].map((i) => positionFor(i, columns, `book-${i}`));
		// Symmetric around 0: col 0 and col 3 mirror, col 1 and col 2 mirror.
		expect(positions[0].x).toBeCloseTo(-1.5 * COVER_COLUMN_PITCH);
		expect(positions[3].x).toBeCloseTo(1.5 * COVER_COLUMN_PITCH);
		expect(positions[0].y).toBeCloseTo(0);
	});

	it('drops to the next row down (negative y) after `columns` books', () => {
		const columns = 4;
		const firstRow = positionFor(0, columns, 'a');
		const secondRow = positionFor(4, columns, 'b');
		expect(secondRow.y).toBeCloseTo(firstRow.y - ROW_PITCH);
	});

	it('is deterministic for the same seed', () => {
		const a = positionFor(0, 4, 'stable-id');
		const b = positionFor(0, 4, 'stable-id');
		expect(a).toEqual(b);
	});

	it('gives different books different jitter/tilt', () => {
		const a = positionFor(0, 4, 'book-a');
		const b = positionFor(0, 4, 'book-b');
		// Same slot (same x/y), but seed-derived z/tilt should differ for most id pairs.
		expect(a.x).toBe(b.x);
		expect(a.z !== b.z || a.tilt !== b.tilt).toBe(true);
	});

	it('packs columns much tighter in spine orientation than cover orientation', () => {
		const cover = positionFor(1, 4, 'book', 'cover');
		const spine = positionFor(1, 4, 'book', 'spine');
		expect(Math.abs(spine.x)).toBeLessThan(Math.abs(cover.x));
		expect(SPINE_COLUMN_PITCH).toBeLessThan(COVER_COLUMN_PITCH);
	});
});

describe('rowCountFor', () => {
	it('rounds up to cover a partial last row', () => {
		expect(rowCountFor(10, 4)).toBe(3);
	});

	it('is 0 for no books', () => {
		expect(rowCountFor(0, 4)).toBe(0);
	});
});

describe('visibleRowRange', () => {
	it('includes a buffer row on both sides', () => {
		const range = visibleRowRange(5, 3, 100, 1);
		expect(range.startRow).toBe(4); // floor(5) - 1
		expect(range.endRow).toBe(9); // ceil(5+3) + 1
	});

	it('clamps to 0 at the top', () => {
		const range = visibleRowRange(0, 3, 100, 1);
		expect(range.startRow).toBe(0);
	});

	it('clamps to the last row at the bottom', () => {
		const range = visibleRowRange(97, 3, 100, 1);
		expect(range.endRow).toBe(99);
	});

	it('returns an empty range for zero rows', () => {
		const range = visibleRowRange(0, 3, 0, 1);
		expect(range.endRow).toBeLessThan(range.startRow);
	});
});

describe('visibleIndices', () => {
	it('expands a row range into flat book indices, columns then rows', () => {
		const indices = visibleIndices({ startRow: 0, endRow: 1 }, 4, 8);
		expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	});

	it('stops at the real book count on a partial last row', () => {
		const indices = visibleIndices({ startRow: 0, endRow: 1 }, 4, 6);
		expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
	});
});
