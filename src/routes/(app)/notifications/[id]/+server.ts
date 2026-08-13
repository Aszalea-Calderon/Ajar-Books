import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteNotification } from '$lib/server/notifications';

// Dismiss a single notification — see notifications/+server.ts's DELETE for
// "clear all" instead. Ownership is enforced by deleteNotification itself
// (scoped to locals.user.id), not here.
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401);
	await deleteNotification(locals.user.id, params.id);
	return json({ ok: true });
};
