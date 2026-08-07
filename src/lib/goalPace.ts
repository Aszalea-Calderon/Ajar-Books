/**
 * Compares progress against target, given how far through the period we are.
 * `behindAmount` is only present when `status` is `'behind'` — how much more
 * would need to be logged right now to be back on pace.
 */
export function computeGoalPace({
	target,
	current,
	periodStart,
	periodEnd,
	today
}: {
	target: number;
	current: number;
	periodStart: Date;
	periodEnd: Date;
	today: Date;
}): { status: 'on-track' | 'behind' | 'reached'; behindAmount?: number } {
	if (current >= target) return { status: 'reached' };

	const totalMs = periodEnd.getTime() - periodStart.getTime();
	const elapsedMs = today.getTime() - periodStart.getTime();
	const elapsedFraction = Math.min(1, Math.max(0, elapsedMs / totalMs));
	const expectedByNow = target * elapsedFraction;

	if (current >= expectedByNow) return { status: 'on-track' };
	return { status: 'behind', behindAmount: Math.ceil(expectedByNow - current) };
}
