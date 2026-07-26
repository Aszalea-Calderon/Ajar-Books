import type { Actions, PageServerLoad } from './$types';
import { updateSettings } from '$lib/server/settings';
import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
import { getLibraryBooks, getUsedTagNames } from '$lib/server/books/library';

const STATUS_ORDER = ['reading', 'want_to_read', 'finished', 'dnf'] as const;

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get('status') ?? '';
	const genreFilter = url.searchParams.get('genre') ?? '';
	const moodFilter = url.searchParams.get('mood') ?? '';
	const settingFilter = url.searchParams.get('setting') ?? '';
	const formatFilter = url.searchParams.get('format') ?? '';
	const favoritesOnly = url.searchParams.get('favorites') === '1';

	const allBooks = await getLibraryBooks();

	const filtered = allBooks.filter((entry) => {
		if (statusFilter && entry.userBook.status !== statusFilter) return false;
		if (genreFilter && !entry.tags.genre.includes(genreFilter)) return false;
		if (moodFilter && !entry.tags.mood.includes(moodFilter)) return false;
		if (settingFilter && !entry.tags.setting.includes(settingFilter)) return false;
		if (formatFilter && entry.userBook.format !== formatFilter) return false;
		if (favoritesOnly && (entry.userBook.rating ?? 0) < 4) return false;
		return true;
	});

	const groups = STATUS_ORDER.map((status) => ({
		status,
		books: filtered.filter((entry) => entry.userBook.status === status)
	})).filter((group) => group.books.length > 0);

	const [genres, moods, settings] = await Promise.all([
		getUsedTagNames('genre'),
		getUsedTagNames('mood'),
		getUsedTagNames('setting')
	]);

	return {
		groups,
		filters: {
			status: statusFilter,
			genre: genreFilter,
			mood: moodFilter,
			setting: settingFilter,
			format: formatFilter,
			favorites: favoritesOnly
		},
		filterOptions: { genres, moods, settings },
		isFiltered: !!(
			statusFilter ||
			genreFilter ||
			moodFilter ||
			settingFilter ||
			formatFilter ||
			favoritesOnly
		),
		totalBookCount: allBooks.length
	};
};

export const actions: Actions = {
	saveGoogleBooksKey: async ({ request }) => {
		const data = await request.formData();
		const key = String(data.get('googleBooksApiKey') ?? '').trim();
		await updateSettings({ googleBooksApiKey: key || null });
	},

	saveLanguagePriority: async ({ request }) => {
		const data = await request.formData();
		const languagePriority = String(data.get('languagePriority') ?? '');
		if (!LANGUAGE_PRIORITY_OPTIONS.some((o) => o.code === languagePriority)) return;
		await updateSettings({ languagePriority });
	}
};
