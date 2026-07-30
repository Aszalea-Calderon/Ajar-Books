import type { ImportRow, ImportSource } from './types';
import { mapGoodreadsRow } from './goodreads';
import { mapStoryGraphRow } from './storygraph';
import { mapGenericRow, type GenericFieldMap } from './generic';

export function mapRow(
	source: ImportSource,
	row: Record<string, string>,
	genericMap?: GenericFieldMap
): ImportRow {
	if (source === 'goodreads') return mapGoodreadsRow(row);
	if (source === 'storygraph') return mapStoryGraphRow(row);
	if (!genericMap) throw new Error('genericMap is required for the generic import source');
	return mapGenericRow(row, genericMap);
}
