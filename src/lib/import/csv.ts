import Papa from 'papaparse';

export type ParsedCsv = {
	headers: string[];
	rows: Record<string, string>[];
};

/**
 * Thin wrapper over papaparse — real export files (Goodreads/StoryGraph)
 * routinely have quoted fields with embedded commas/newlines (review text,
 * multi-author lists), which a hand-rolled split(',') would mangle.
 */
export function parseCsv(text: string): ParsedCsv {
	const result = Papa.parse<Record<string, string>>(text, {
		header: true,
		skipEmptyLines: true,
		transformHeader: (header) => header.trim()
	});

	return {
		headers: result.meta.fields ?? [],
		rows: result.data
	};
}
