import { describe, expect, it } from 'vitest';
import { detectSource } from './detect';

describe('detectSource', () => {
	it('detects Goodreads', () => {
		expect(detectSource(['Book Id', 'Title', 'Exclusive Shelf'])).toBe('goodreads');
	});

	it('detects StoryGraph', () => {
		expect(detectSource(['Title', 'Read Status', 'Moods'])).toBe('storygraph');
	});

	it('falls back to generic for anything unrecognized', () => {
		expect(detectSource(['Title', 'Author', 'Some Custom Column'])).toBe('generic');
	});
});
