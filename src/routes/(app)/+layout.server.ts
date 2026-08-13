import type { LayoutServerLoad } from './$types';
import { getSettings } from '$lib/server/settings';
import { getAllTagsWithUsage, type TagType } from '$lib/server/books/tags';
import { hasRecoveryKey } from '$lib/server/auth';

const TAG_TYPES: TagType[] = ['genre', 'mood', 'setting'];

export const load: LayoutServerLoad = async ({ locals }) => {
	const settings = await getSettings();

	const manageableTags = Object.fromEntries(
		await Promise.all(
			TAG_TYPES.map(async (type) => [type, await getAllTagsWithUsage(type)] as const)
		)
	) as Record<TagType, Awaited<ReturnType<typeof getAllTagsWithUsage>>>;

	return {
		user: locals.user,
		googleBooksApiKey: settings.googleBooksApiKey,
		languagePriority: settings.languagePriority,
		manageableTags,
		hasRecoveryKey: locals.user ? await hasRecoveryKey(locals.user.id) : false
	};
};
