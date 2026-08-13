import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { resetPasswordWithRecoveryKey } from '$lib/server/auth';
import { checkRateLimit, clearAttempts, recordFailedAttempt } from '$lib/server/rateLimit';

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const ip = getClientAddress();
		const data = await request.formData();
		const recoveryKey = String(data.get('recoveryKey') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirmPassword = String(data.get('confirmPassword') ?? '');

		// Same limiter as /login — brute-forcing a recovery key is the same
		// class of risk as brute-forcing a password.
		const rateLimit = checkRateLimit(ip);
		if (!rateLimit.allowed) {
			const minutes = Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60);
			return fail(429, {
				error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
			});
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		const ok = await resetPasswordWithRecoveryKey(recoveryKey, password);
		if (!ok) {
			recordFailedAttempt(ip);
			return fail(400, { error: 'That recovery key is incorrect or has already been used.' });
		}

		clearAttempts(ip);
		throw redirect(303, '/login');
	}
};
