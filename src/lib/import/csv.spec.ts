import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
	it('parses a simple CSV into headers and rows', () => {
		const result = parseCsv('Title,Author\nDune,Frank Herbert\n1984,George Orwell');
		expect(result.headers).toEqual(['Title', 'Author']);
		expect(result.rows).toEqual([
			{ Title: 'Dune', Author: 'Frank Herbert' },
			{ Title: '1984', Author: 'George Orwell' }
		]);
	});

	it('handles quoted fields with embedded commas and newlines', () => {
		const result = parseCsv('Title,Review\n"Dune","Great book, would recommend.\nRead it twice."');
		expect(result.rows[0].Review).toBe('Great book, would recommend.\nRead it twice.');
	});

	it('trims whitespace from header names', () => {
		const result = parseCsv(' Title , Author \nDune,Frank Herbert');
		expect(result.headers).toEqual(['Title', 'Author']);
	});

	it('skips empty lines', () => {
		const result = parseCsv('Title,Author\nDune,Frank Herbert\n\n1984,George Orwell');
		expect(result.rows).toHaveLength(2);
	});
});
