import type { Actions, PageServerLoad } from './$types';
import { getSettings, updateSettings } from '$lib/server/settings';

export const load: PageServerLoad = async () => {
	const settings = await getSettings();
	return { googleBooksApiKey: settings.googleBooksApiKey };
};

export const actions: Actions = {
	saveGoogleBooksKey: async ({ request }) => {
		const data = await request.formData();
		const key = String(data.get('googleBooksApiKey') ?? '').trim();
		await updateSettings({ googleBooksApiKey: key || null });
	}
};
