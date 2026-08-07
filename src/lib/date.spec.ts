import { describe, expect, it } from 'vitest';
import { getPeriodRange, parseLocalDateInput, toLocalDateInputValue } from './date';

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

function ymd(date: Date) {
	return [date.getFullYear(), date.getMonth(), date.getDate()];
}

describe('getPeriodRange', () => {
	it('resolves a week to its Monday start (exclusive end the following Monday)', () => {
		// 2026-08-05 is a Wednesday.
		const { start, end } = getPeriodRange('week', new Date(2026, 7, 5));
		expect(ymd(start)).toEqual([2026, 7, 3]); // Mon Aug 3
		expect(ymd(end)).toEqual([2026, 7, 10]); // Mon Aug 10
	});

	it('keeps a Monday reference as its own week start', () => {
		const { start, end } = getPeriodRange('week', new Date(2026, 7, 3));
		expect(ymd(start)).toEqual([2026, 7, 3]);
		expect(ymd(end)).toEqual([2026, 7, 10]);
	});

	it('lets a week cross a month boundary', () => {
		// 2026-11-01 is a Sunday, so its week starts Mon Oct 26.
		const { start, end } = getPeriodRange('week', new Date(2026, 10, 1));
		expect(ymd(start)).toEqual([2026, 9, 26]); // Mon Oct 26
		expect(ymd(end)).toEqual([2026, 10, 2]); // Mon Nov 2
	});

	it('lets a week cross a year boundary', () => {
		// 2026-01-01 is a Thursday, so its week starts Mon Dec 29, 2025.
		const { start, end } = getPeriodRange('week', new Date(2026, 0, 1));
		expect(ymd(start)).toEqual([2025, 11, 29]);
		expect(ymd(end)).toEqual([2026, 0, 5]);
	});

	it('resolves a month to its calendar boundaries', () => {
		const { start, end } = getPeriodRange('month', new Date(2026, 7, 17));
		expect(ymd(start)).toEqual([2026, 7, 1]);
		expect(ymd(end)).toEqual([2026, 8, 1]);
	});

	it('rolls a December month into January of the next year', () => {
		const { start, end } = getPeriodRange('month', new Date(2026, 11, 25));
		expect(ymd(start)).toEqual([2026, 11, 1]);
		expect(ymd(end)).toEqual([2027, 0, 1]);
	});

	it('resolves a year to its calendar boundaries', () => {
		const { start, end } = getPeriodRange('year', new Date(2026, 5, 15));
		expect(ymd(start)).toEqual([2026, 0, 1]);
		expect(ymd(end)).toEqual([2027, 0, 1]);
	});
});
