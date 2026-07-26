import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, hashPassword, setSessionCookie } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		if (username.length < 3) {
			return fail(400, { error: 'Username must be at least 3 characters.', username });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', username });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.', username });
		}

		const [user] = await db
			.insert(users)
			.values({ username, passwordHash: hashPassword(password) })
			.returning();

		const token = await createSession(user.id);
		setSessionCookie(cookies, token);

		throw redirect(303, '/');
	}
};
