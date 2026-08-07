/** Formats a Date as a local (not UTC) YYYY-MM-DD string, suitable for <input type="date">. */
export function toLocalDateInputValue(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 10);
}

export function todayLocalDateString(): string {
	return toLocalDateInputValue(new Date());
}

/**
 * Parses a plain "YYYY-MM-DD" <input type="date"> value as local midnight.
 * `new Date("YYYY-MM-DD")` parses as UTC midnight instead, which lands on
 * the *previous* day once displayed in any timezone behind UTC — a classic
 * off-by-one. Returns null for anything that doesn't match the expected
 * shape, so callers can fall back to "now".
 */
export function parseLocalDateInput(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Returns the [start, end) local-midnight boundary for the week, month, or
 * year containing `reference`. Weeks start Monday (ISO-style), not Sunday.
 * `end` is exclusive — a value equal to `end` belongs to the next period.
 */
export function getPeriodRange(
	period: 'week' | 'month' | 'year',
	reference: Date
): { start: Date; end: Date } {
	if (period === 'week') {
		// getDay(): 0=Sun..6=Sat. Days since the most recent Monday.
		const daysSinceMonday = (reference.getDay() + 6) % 7;
		const start = new Date(
			reference.getFullYear(),
			reference.getMonth(),
			reference.getDate() - daysSinceMonday
		);
		const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
		return { start, end };
	}
	if (period === 'month') {
		const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
		const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
		return { start, end };
	}
	const start = new Date(reference.getFullYear(), 0, 1);
	const end = new Date(reference.getFullYear() + 1, 0, 1);
	return { start, end };
}
