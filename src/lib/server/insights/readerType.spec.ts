import { describe, expect, it } from 'vitest';
import { computeReaderTypeFacts, pickReaderTypeSummary } from './readerType';
import type { PaceStats } from './stats';

const NO_PACE: PaceStats = { averageDaysPerBook: null, pagesPerActiveDay: null, minutesPerActiveDay: null };
const FULL_PACE: PaceStats = { averageDaysPerBook: 7, pagesPerActiveDay: 30, minutesPerActiveDay: 20 };

describe('computeReaderTypeFacts', () => {
	it('picks the top genre as dominant', () => {
		const facts = computeReaderTypeFacts(
			[
				{ genre: 'Fantasy', count: 5 },
				{ genre: 'History', count: 2 }
			],
			{ fiction: 1, nonfiction: 0, unclassified: 0 },
			NO_PACE
		);
		expect(facts.dominantGenre).toBe('Fantasy');
	});

	it('is null with no genre tags at all', () => {
		const facts = computeReaderTypeFacts([], { fiction: 0, nonfiction: 0, unclassified: 0 }, NO_PACE);
		expect(facts.dominantGenre).toBeNull();
		expect(facts.fictionLeaning).toBeNull();
	});

	it('classifies fiction-leaning at a 65%+ majority', () => {
		const facts = computeReaderTypeFacts(
			[],
			{ fiction: 7, nonfiction: 3, unclassified: 0 },
			NO_PACE
		);
		expect(facts.fictionLeaning).toBe('fiction');
	});

	it('classifies nonfiction-leaning at a 65%+ majority', () => {
		const facts = computeReaderTypeFacts(
			[],
			{ fiction: 2, nonfiction: 8, unclassified: 0 },
			NO_PACE
		);
		expect(facts.fictionLeaning).toBe('nonfiction');
	});

	it('classifies a near-even split as mixed rather than picking a side', () => {
		const facts = computeReaderTypeFacts(
			[],
			{ fiction: 5, nonfiction: 5, unclassified: 0 },
			NO_PACE
		);
		expect(facts.fictionLeaning).toBe('mixed');
	});
});

describe('pickReaderTypeSummary', () => {
	it('falls back to a generic line when no facts are available at all', () => {
		const facts = computeReaderTypeFacts([], { fiction: 0, nonfiction: 0, unclassified: 0 }, NO_PACE);
		expect(pickReaderTypeSummary(facts)).toBe(
			'Log a bit more reading to start seeing your reader type here.'
		);
	});

	it('always returns one of the genre+pace-aware templates once every fact is available', () => {
		const facts = computeReaderTypeFacts(
			[{ genre: 'Fantasy', count: 3 }],
			{ fiction: 8, nonfiction: 2, unclassified: 0 },
			FULL_PACE
		);
		// random() = 0 always picks the first satisfied template deterministically.
		const summary = pickReaderTypeSummary(facts, () => 0);
		expect(summary).toContain('Fantasy');
	});

	it('is deterministic given an injected random function', () => {
		const facts = computeReaderTypeFacts(
			[{ genre: 'History', count: 1 }],
			{ fiction: 0, nonfiction: 0, unclassified: 1 },
			NO_PACE
		);
		const first = pickReaderTypeSummary(facts, () => 0);
		const second = pickReaderTypeSummary(facts, () => 0);
		expect(first).toBe(second);
	});
});
