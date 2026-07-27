import type { Actions, PageServerLoad } from './$types';
import { updateSettings } from '$lib/server/settings';
import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
import { getLibraryBooks, getUsedTagNames, type LibraryBook } from '$lib/server/books/library';
import { deleteTagGlobally, renameTag } from '$lib/server/books/tags';

const STATUS_ORDER = ['reading', 'want_to_read', 'finished', 'dnf'] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
	reading: 'Currently Reading',
	want_to_read: 'Want to Read',
	finished: 'Finished',
	dnf: 'Did Not Finish'
};

// A book with no genre tags falls into this catch-all bucket rather than
// being silently dropped from its status section — sorted last, after every
// real genre.
const NO_GENRE_BUCKET = 'More to explore';

function groupByGenre(entries: LibraryBook[]) {
	const groups = new Map<string, LibraryBook[]>();
	for (const entry of entries) {
		const genres = entry.tags.genre.length > 0 ? entry.tags.genre : [NO_GENRE_BUCKET];
		for (const genre of genres) {
			const list = groups.get(genre) ?? [];
			list.push(entry);
			groups.set(genre, list);
		}
	}
	return [...groups.entries()]
		.map(([genre, books]) => ({ genre, books }))
		.sort((a, b) => {
			if (a.genre === NO_GENRE_BUCKET) return 1;
			if (b.genre === NO_GENRE_BUCKET) return -1;
			return a.genre.localeCompare(b.genre);
		});
}

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get('status') ?? '';
	const genreFilter = url.searchParams.get('genre') ?? '';
	const moodFilter = url.searchParams.get('mood') ?? '';
	const formatFilter = url.searchParams.get('format') ?? '';

	const allBooks = await getLibraryBooks();

	const filtered = allBooks.filter((entry) => {
		if (statusFilter && entry.userBook.status !== statusFilter) return false;
		if (genreFilter && !entry.tags.genre.includes(genreFilter)) return false;
		if (moodFilter && !entry.tags.mood.includes(moodFilter)) return false;
		if (formatFilter && entry.userBook.format !== formatFilter) return false;
		return true;
	});

	const favoriteEntries = filtered.filter((entry) => entry.userBook.isFavorite);

	// Favorites is a cross-status shelf, not a status of its own — a
	// favorited finished book still shows up in Finished too, further down.
	const sections = [
		...(favoriteEntries.length > 0
			? [
					{
						status: 'favorites' as const,
						label: 'Favorites',
						groups: groupByGenre(favoriteEntries)
					}
				]
			: []),
		...STATUS_ORDER.map((status) => ({
			status,
			label: STATUS_LABELS[status],
			groups: groupByGenre(filtered.filter((entry) => entry.userBook.status === status))
		})).filter((section) => section.groups.length > 0)
	];

	const [genres, moods] = await Promise.all([getUsedTagNames('genre'), getUsedTagNames('mood')]);

	return {
		sections,
		filters: {
			status: statusFilter,
			genre: genreFilter,
			mood: moodFilter,
			format: formatFilter
		},
		filterOptions: { genres, moods },
		isFiltered: !!(statusFilter || genreFilter || moodFilter || formatFilter),
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
	},

	renameTag: async ({ request }) => {
		const data = await request.formData();
		const tagId = String(data.get('tagId') ?? '');
		const name = String(data.get('name') ?? '');
		if (!tagId || !name.trim()) return;
		await renameTag(tagId, name);
	},

	deleteTag: async ({ request }) => {
		const data = await request.formData();
		const tagId = String(data.get('tagId') ?? '');
		if (!tagId) return;
		await deleteTagGlobally(tagId);
	}
};
