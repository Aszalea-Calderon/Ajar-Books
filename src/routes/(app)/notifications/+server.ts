import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUnreadCount, listNotifications, markAllRead } from '$lib/server/notifications';

// Polled from the app shell's bell icon (see (app)/+layout.svelte) so a
// background event — an import finishing while you're elsewhere in the
// app — shows up without a page reload.
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401);
	const [notifications, unreadCount] = await Promise.all([
		listNotifications(locals.user.id),
		getUnreadCount(locals.user.id)
	]);
	return json({ notifications, unreadCount });
};

// Marks everything read in one action — fired when the bell dropdown opens.
export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) return error(401);
	await markAllRead(locals.user.id);
	return json({ ok: true });
};
