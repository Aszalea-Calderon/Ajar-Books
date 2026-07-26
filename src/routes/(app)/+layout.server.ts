import type { LayoutServerLoad } from './$types';
import { getSettings } from '$lib/server/settings';

export const load: LayoutServerLoad = async ({ locals }) => {
	const settings = await getSettings();
	return {
		user: locals.user,
		googleBooksApiKey: settings.googleBooksApiKey,
		languagePriority: settings.languagePriority
	};
};
