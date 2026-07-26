import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, setSessionCookie, verifyPassword } from '$lib/server/auth';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const [user] = await db.select().from(users).where(eq(users.username, username));

		if (!user || !verifyPassword(password, user.passwordHash)) {
			return fail(400, { error: 'Incorrect username or password.', username });
		}

		const token = await createSession(user.id);
		setSessionCookie(cookies, token);

		throw redirect(303, '/');
	}
};
