import { describe, expect, it } from 'vitest';
import {
	computeCurrentStreak,
	computeWeeklyStreak,
	computeLongestStreakEver,
	isStreakRecord
} from './streak';

const today = new Date(2026, 7, 5); // Wednesday, Aug 5 2026

describe('computeCurrentStreak', () => {
	it('returns 0 when neither today nor yesterday has activity', () => {
		expect(computeCurrentStreak(new Set(['2026-08-01']), today)).toBe(0);
	});

	it('counts consecutive days ending today', () => {
		const dates = new Set(['2026-08-03', '2026-08-04', '2026-08-05']);
		expect(computeCurrentStreak(dates, today)).toBe(3);
	});

	it("doesn't zero out the streak just because today hasn't been logged yet", () => {
		const dates = new Set(['2026-08-03', '2026-08-04']);
		expect(computeCurrentStreak(dates, today)).toBe(2);
	});

	it('stops at the first gap', () => {
		const dates = new Set(['2026-08-01', '2026-08-04', '2026-08-05']);
		expect(computeCurrentStreak(dates, today)).toBe(2);
	});

	it('a single active day today is a streak of 1', () => {
		expect(computeCurrentStreak(new Set(['2026-08-05']), today)).toBe(1);
	});
});

describe('computeWeeklyStreak', () => {
	// today (Aug 5 2026) is in the Mon Aug 3 - Sun Aug 9 week.
	it('counts this week even with just one entry, plus unbroken prior weeks', () => {
		const dates = new Set([
			'2026-08-05', // this week
			'2026-07-30', // last week (Mon Jul 27 - Sun Aug 2)
			'2026-07-20' // the week before that (Mon Jul 20 - Sun Jul 26)
		]);
		expect(computeWeeklyStreak(dates, today)).toBe(3);
	});

	it("doesn't zero out the streak just because this week hasn't been logged yet", () => {
		const dates = new Set(['2026-07-30', '2026-07-20']);
		expect(computeWeeklyStreak(dates, today)).toBe(2);
	});

	it('stops at the first missed week', () => {
		const dates = new Set(['2026-08-05', '2026-07-10']); // a whole week gap in between
		expect(computeWeeklyStreak(dates, today)).toBe(1);
	});

	it('returns 0 when neither this week nor last week has activity', () => {
		expect(computeWeeklyStreak(new Set(['2026-06-01']), today)).toBe(0);
	});
});

describe('computeLongestStreakEver', () => {
	it('returns 0 for no history', () => {
		expect(computeLongestStreakEver(new Set())).toBe(0);
	});

	it('finds the longest run even when it is not the most recent one', () => {
		const dates = new Set([
			// a 4-day run, well in the past
			'2026-01-01',
			'2026-01-02',
			'2026-01-03',
			'2026-01-04',
			// a shorter, more recent 2-day run
			'2026-08-04',
			'2026-08-05'
		]);
		expect(computeLongestStreakEver(dates)).toBe(4);
	});

	it('counts the current still-open run like any other', () => {
		const dates = new Set(['2026-08-03', '2026-08-04', '2026-08-05']);
		expect(computeLongestStreakEver(dates)).toBe(3);
	});
});

describe('isStreakRecord', () => {
	it('is true when the current streak matches the all-time longest', () => {
		expect(isStreakRecord(5, 5)).toBe(true);
	});

	it('is true when the current streak exceeds the all-time longest', () => {
		expect(isStreakRecord(6, 5)).toBe(true);
	});

	it('is false when a past run was strictly longer', () => {
		expect(isStreakRecord(3, 5)).toBe(false);
	});

	it('is false when there is no current streak', () => {
		expect(isStreakRecord(0, 5)).toBe(false);
	});
});
