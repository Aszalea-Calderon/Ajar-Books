import { describe, expect, it } from 'vitest';
import { parseLocalDateInput, toLocalDateInputValue } from './date';

describe('parseLocalDateInput', () => {
	it('parses a date-only string as local midnight, not UTC midnight', () => {
		// The classic pitfall: new Date('2026-07-26') parses as UTC midnight,
		// which lands on the *previous* day in any timezone behind UTC.
		const parsed = parseLocalDateInput('2026-07-26');
		expect(parsed).not.toBeNull();
		expect(parsed?.getFullYear()).toBe(2026);
		expect(parsed?.getMonth()).toBe(6); // 0-indexed: July
		expect(parsed?.getDate()).toBe(26);
		expect(parsed?.getHours()).toBe(0);
	});

	it('round-trips with toLocalDateInputValue', () => {
		const original = new Date(2026, 6, 26);
		const roundTripped = parseLocalDateInput(toLocalDateInputValue(original));
		expect(roundTripped?.getFullYear()).toBe(original.getFullYear());
		expect(roundTripped?.getMonth()).toBe(original.getMonth());
		expect(roundTripped?.getDate()).toBe(original.getDate());
	});

	it('returns null for a malformed input', () => {
		expect(parseLocalDateInput('')).toBeNull();
		expect(parseLocalDateInput('not-a-date')).toBeNull();
		expect(parseLocalDateInput('07/26/2026')).toBeNull();
	});
});
