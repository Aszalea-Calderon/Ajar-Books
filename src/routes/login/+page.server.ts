import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, setSessionCookie, verifyPassword } from '$lib/server/auth';
import { checkRateLimit, clearAttempts, recordFailedAttempt } from '$lib/server/rateLimit';

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const ip = getClientAddress();
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const rateLimit = checkRateLimit(ip);
		if (!rateLimit.allowed) {
			const minutes = Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60);
			return fail(429, {
				error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
				username
			});
		}

		const [user] = await db.select().from(users).where(eq(users.username, username));

		if (!user || !verifyPassword(password, user.passwordHash)) {
			recordFailedAttempt(ip);
			return fail(400, { error: 'Incorrect username or password.', username });
		}

		clearAttempts(ip);

		const token = await createSession(user.id);
		setSessionCookie(cookies, token);

		throw redirect(303, '/');
	}
};
