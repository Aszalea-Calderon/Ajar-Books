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
