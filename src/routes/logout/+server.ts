import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie, getSessionCookie, invalidateSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = getSessionCookie(cookies);
	if (token) {
		await invalidateSession(token);
		clearSessionCookie(cookies);
	}
	throw redirect(303, '/login');
};
