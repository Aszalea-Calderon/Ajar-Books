import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSessionCookie, hasAnyUser, validateSessionToken } from '$lib/server/auth';
import { scheduleBackups } from '$lib/server/backup';

// Module-scope, not inside `handle` — this must run exactly once per
// process. scheduleBackups() itself is idempotent (see its own
// globalThis-guard) as a backstop against Vite's dev-mode module
// re-evaluation, but there's no reason to even call it more than once here.
scheduleBackups();

const PUBLIC_PATHS = new Set(['/login', '/setup', '/recover']);

export const handle: Handle = async ({ event, resolve }) => {
	const token = getSessionCookie(event.cookies);
	const { user } = token ? await validateSessionToken(token) : { user: null };
	event.locals.user = user
		? { id: user.id, username: user.username, avatarEmoji: user.avatarEmoji }
		: null;

	const path = event.url.pathname;
	const isAsset = path.startsWith('/_app') || path.startsWith('/favicon');

	if (!isAsset) {
		const setupDone = await hasAnyUser();

		if (!setupDone && path !== '/setup') {
			throw redirect(303, '/setup');
		}
		if (setupDone && path === '/setup') {
			throw redirect(303, event.locals.user ? '/' : '/login');
		}
		if (setupDone && !event.locals.user && !PUBLIC_PATHS.has(path)) {
			throw redirect(303, '/login');
		}
		if (event.locals.user && path === '/login') {
			throw redirect(303, '/');
		}
	}

	return resolve(event);
};
