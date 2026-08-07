import { describe, expect, it } from 'vitest';
import { computeGoalPace } from './goalPace';

// A 10-day period, e.g. periodStart..periodEnd, so "today at day 5" is 50% elapsed.
const periodStart = new Date(2026, 7, 1);
const periodEnd = new Date(2026, 7, 11);
const halfway = new Date(2026, 7, 6);

describe('computeGoalPace', () => {
	it('is reached once current meets or exceeds target, regardless of pace', () => {
		expect(
			computeGoalPace({ target: 10, current: 10, periodStart, periodEnd, today: periodStart })
		).toEqual({ status: 'reached' });
		expect(
			computeGoalPace({ target: 10, current: 12, periodStart, periodEnd, today: halfway })
		).toEqual({ status: 'reached' });
	});

	it('is on-track when current meets or exceeds the expected-by-now amount', () => {
		// Halfway through a 10-day period expects ~5 out of target 10.
		expect(
			computeGoalPace({ target: 10, current: 5, periodStart, periodEnd, today: halfway })
		).toEqual({ status: 'on-track' });
		expect(
			computeGoalPace({ target: 10, current: 8, periodStart, periodEnd, today: halfway })
		).toEqual({ status: 'on-track' });
	});

	it('is behind with a rounded-up catch-up amount when under pace', () => {
		expect(
			computeGoalPace({ target: 10, current: 2, periodStart, periodEnd, today: halfway })
		).toEqual({ status: 'behind', behindAmount: 3 });
	});

	it('is on-track at the very start of the period regardless of current', () => {
		expect(
			computeGoalPace({ target: 10, current: 0, periodStart, periodEnd, today: periodStart })
		).toEqual({ status: 'on-track' });
	});

	it('clamps expected-by-now at the target once the period has ended', () => {
		const afterEnd = new Date(2026, 7, 20);
		expect(
			computeGoalPace({ target: 10, current: 4, periodStart, periodEnd, today: afterEnd })
		).toEqual({ status: 'behind', behindAmount: 6 });
	});
});
