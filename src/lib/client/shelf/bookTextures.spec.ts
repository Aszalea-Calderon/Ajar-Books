import { describe, expect, it } from 'vitest';
import { hasShelfBadge, type ShelfBook } from './bookTextures';

function book(overrides: Partial<ShelfBook> = {}): ShelfBook {
	return {
		id: '1',
		title: 'Test Book',
		author: null,
		status: 'added',
		rating: null,
		...overrides
	};
}

describe('hasShelfBadge', () => {
	it('is false for the neutral "added" status with no rating', () => {
		expect(hasShelfBadge(book())).toBe(false);
	});

	it('is true for any real status', () => {
		expect(hasShelfBadge(book({ status: 'want_to_read' }))).toBe(true);
		expect(hasShelfBadge(book({ status: 'reading' }))).toBe(true);
		expect(hasShelfBadge(book({ status: 'finished' }))).toBe(true);
		expect(hasShelfBadge(book({ status: 'dnf' }))).toBe(true);
	});

	it('is true when only a rating is present, even at the neutral status', () => {
		expect(hasShelfBadge(book({ rating: 4.5 }))).toBe(true);
	});
});
