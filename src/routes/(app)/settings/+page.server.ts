import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/settings';
import { getAllTagsWithUsage, type TagType } from '$lib/server/books/tags';
import { listCustomThemes } from '$lib/server/customThemes';

const TAG_TYPES: TagType[] = ['genre', 'mood', 'setting'];

// Split out of the shared (app) layout load — googleBooksApiKey,
// languagePriority, manageableTags, and customThemes are only ever read by
// this page's own tabs, but living in the layout meant every route paid for
// them (3 tag-usage queries plus a settings row) on every navigation.
export const load: PageServerLoad = async () => {
	const [settings, tagEntries, customThemes] = await Promise.all([
		getSettings(),
		Promise.all(TAG_TYPES.map(async (type) => [type, await getAllTagsWithUsage(type)] as const)),
		listCustomThemes()
	]);

	const manageableTags = Object.fromEntries(tagEntries) as Record<
		TagType,
		Awaited<ReturnType<typeof getAllTagsWithUsage>>
	>;

	return {
		googleBooksApiKey: settings.googleBooksApiKey,
		languagePriority: settings.languagePriority,
		manageableTags,
		customThemes
	};
};
