import type { Actions } from './$types';
import { updateSettings } from '$lib/server/settings';

export const actions: Actions = {
	saveGoogleBooksKey: async ({ request }) => {
		const data = await request.formData();
		const key = String(data.get('googleBooksApiKey') ?? '').trim();
		await updateSettings({ googleBooksApiKey: key || null });
	}
};
