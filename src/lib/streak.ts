import { toLocalDateInputValue, parseLocalDateInput, getPeriodRange } from './date';

/**
 * Consecutive-day streak ending at `today`, walking backward through
 * `activeDates` (local YYYY-MM-DD strings). If today has no activity yet,
 * the streak starts from yesterday instead — a day isn't over yet, so an
 * unlogged today shouldn't zero out yesterday's streak.
 */
export function computeCurrentStreak(activeDates: Set<string>, today: Date): number {
	let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	if (!activeDates.has(toLocalDateInputValue(cursor))) {
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
	}

	let streak = 0;
	while (activeDates.has(toLocalDateInputValue(cursor))) {
		streak++;
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
	}
	return streak;
}

function weekHasActivity(activeDates: Set<string>, reference: Date): boolean {
	const { start, end } = getPeriodRange('week', reference);
	const cursor = new Date(start);
	while (cursor < end) {
		if (activeDates.has(toLocalDateInputValue(cursor))) return true;
		cursor.setDate(cursor.getDate() + 1);
	}
	return false;
}

/**
 * Consecutive-week streak ending at the Monday-start week containing
 * `today` — same grace rule as `computeCurrentStreak`, just one level up:
 * if this week has nothing logged yet, it isn't over, so it doesn't zero
 * out an otherwise-unbroken run of prior weeks.
 */
export function computeWeeklyStreak(activeDates: Set<string>, today: Date): number {
	let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	if (!weekHasActivity(activeDates, cursor)) {
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
	}

	let streak = 0;
	while (weekHasActivity(activeDates, cursor)) {
		streak++;
		cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
	}
	return streak;
}

/**
 * Longest run of consecutive calendar days anywhere in `activeDates`'
 * history, current still-open run included — a full scan, not windowed,
 * since a single user's reading-log history is small enough that this is
 * cheap even unbounded (matches `getMonthActivity`'s fetch-then-reduce
 * style rather than pushing the computation into SQL).
 */
export function computeLongestStreakEver(activeDates: Set<string>): number {
	const sorted = [...activeDates].sort();

	let longest = 0;
	let current = 0;
	let previous: Date | null = null;

	for (const dateStr of sorted) {
		const date = parseLocalDateInput(dateStr);
		if (!date) continue;

		const isConsecutive = previous
			? Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1
			: false;
		current = isConsecutive ? current + 1 : 1;
		longest = Math.max(longest, current);
		previous = date;
	}

	return longest;
}

/**
 * True when the current streak matches or exceeds the longest streak ever
 * recorded — since `longestStreakEver` is itself a max over every run
 * including the current (still-open) one, the current run being the reason
 * `longestStreakEver` is that high *is* what "beat your record" means, no
 * separate "exclude the current run" step needed.
 */
export function isStreakRecord(currentStreak: number, longestStreakEver: number): boolean {
	return currentStreak > 0 && currentStreak >= longestStreakEver;
}
