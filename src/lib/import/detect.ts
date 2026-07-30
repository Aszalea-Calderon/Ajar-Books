import type { ImportSource } from './types';
import { looksLikeGoodreads } from './goodreads';
import { looksLikeStoryGraph } from './storygraph';

export function detectSource(headers: string[]): ImportSource {
	if (looksLikeGoodreads(headers)) return 'goodreads';
	if (looksLikeStoryGraph(headers)) return 'storygraph';
	return 'generic';
}
