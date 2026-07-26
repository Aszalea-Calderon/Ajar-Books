/** Formats a Date as a local (not UTC) YYYY-MM-DD string, suitable for <input type="date">. */
export function toLocalDateInputValue(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 10);
}

export function todayLocalDateString(): string {
	return toLocalDateInputValue(new Date());
}
