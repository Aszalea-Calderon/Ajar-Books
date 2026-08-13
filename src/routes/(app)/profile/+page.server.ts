import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { updateSettings } from '$lib/server/settings';
import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
import { getLibraryBooks, getUsedTagNames } from '$lib/server/books/library';
import { deleteTagGlobally, renameTag } from '$lib/server/books/tags';
import { backfillMissingMetadata } from '$lib/server/books/backfill';
import { generateRecoveryKey, updateUsername } from '$lib/server/auth';
import { createNotification } from '$lib/server/notifications';
import { deleteAllLibraryData } from '$lib/server/deleteAllData';

const STATUS_ORDER = ['reading', 'want_to_read', 'finished', 'dnf'] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
	reading: 'Currently Reading',
	want_to_read: 'Want to Read',
	finished: 'Finished',
	dnf: 'Did Not Finish'
};

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get('status') ?? '';
	const genreFilter = url.searchParams.get('genre') ?? '';
	const moodFilter = url.searchParams.get('mood') ?? '';
	const formatFilter = url.searchParams.get('format') ?? '';
	// A minimum-stars threshold ("4+ stars"), not an exact match — the rating
	// itself supports quarter-star increments, but bucketing the filter by
	// whole stars is the usual "N and up" pattern and keeps the dropdown short.
	const ratingFilter = url.searchParams.get('rating') ?? '';
	const queryFilter = (url.searchParams.get('q') ?? '').trim().toLowerCase();

	const allBooks = await getLibraryBooks();

	const filtered = allBooks.filter((entry) => {
		if (statusFilter && entry.userBook.status !== statusFilter) return false;
		if (genreFilter && !entry.tags.genre.includes(genreFilter)) return false;
		if (moodFilter && !entry.tags.mood.includes(moodFilter)) return false;
		if (formatFilter && entry.userBook.format !== formatFilter) return false;
		if (ratingFilter && (entry.userBook.rating ?? 0) < Number(ratingFilter)) return false;
		if (
			queryFilter &&
			!entry.book.title.toLowerCase().includes(queryFilter) &&
			!entry.book.author?.toLowerCase().includes(queryFilter)
		)
			return false;
		return true;
	});

	const favoriteEntries = filtered.filter((entry) => entry.userBook.isFavorite);

	// Favorites is a cross-status shelf, not a status of its own — a
	// favorited finished book still shows up in Finished too, further down.
	const sections = [
		...(favoriteEntries.length > 0
			? [{ status: 'favorites' as const, label: 'Favorites', books: favoriteEntries }]
			: []),
		...STATUS_ORDER.map((status) => ({
			status,
			label: STATUS_LABELS[status],
			books: filtered.filter((entry) => entry.userBook.status === status)
		})).filter((section) => section.books.length > 0)
	];

	const [genres, moods] = await Promise.all([getUsedTagNames('genre'), getUsedTagNames('mood')]);

	return {
		sections,
		// A flat, ungrouped list for the Table view — a spreadsheet-like scan
		// of everything matching the current filters shouldn't repeat a
		// favorited book the way the card/list sections deliberately do.
		books: filtered,
		filters: {
			status: statusFilter,
			genre: genreFilter,
			mood: moodFilter,
			format: formatFilter,
			rating: ratingFilter,
			q: url.searchParams.get('q') ?? ''
		},
		filterOptions: { genres, moods },
		isFiltered: !!(
			statusFilter ||
			genreFilter ||
			moodFilter ||
			formatFilter ||
			ratingFilter ||
			queryFilter
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
	},

	// One-time catch-up for books added before addBookToLibrary's ISBN-lookup
	// path existed — mainly CSV imports, which never fetched cover/description/
	// genre at all. Safe to re-run anytime; it only ever fills in what's
	// still missing. See backfill.ts for why this stays sequential.
	backfillMetadata: async ({ locals }) => {
		if (!locals.user) return fail(401);
		const outcomes = await backfillMissingMetadata();
		// Skip the notification when there was nothing to do — "0 books
		// updated" isn't worth a persistent record, and the inline result
		// below already says so for whoever's watching this run.
		if (outcomes.length > 0) {
			await createNotification(
				locals.user.id,
				'backfill_complete',
				`Backfill complete — updated ${outcomes.length} book${outcomes.length === 1 ? '' : 's'}.`
			);
		}
		return {
			backfillDone: true,
			backfillCount: outcomes.length
		};
	},

	updateUsername: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const username = String((await request.formData()).get('username') ?? '');
		const ok = await updateUsername(locals.user.id, username);
		if (!ok) {
			return fail(400, { usernameError: "That username is empty or already taken." });
		}
		return { usernameUpdated: true };
	},

	// Overwrites (invalidates) any previous key. The plaintext is only ever
	// in this one response — nothing persists it beyond the hash.
	generateRecoveryKey: async ({ locals }) => {
		if (!locals.user) return fail(401);
		const key = await generateRecoveryKey(locals.user.id);
		return { recoveryKey: key };
	},

	// The account itself (login, recovery key, settings) is untouched — only
	// library data goes. Confirmation UX (typed "DELETE") lives entirely in
	// the Settings page; this action trusts it was already gated by the time
	// the request lands here, same as every other destructive action in this
	// app has no server-side re-confirmation step of its own.
	deleteAllData: async ({ locals }) => {
		if (!locals.user) return fail(401);
		await deleteAllLibraryData();
		return { dataDeleted: true };
	}
};
