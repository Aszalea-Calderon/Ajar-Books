import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { generateRecoveryKey, resetPasswordWithRecoveryKey } from '$lib/server/auth';
import { checkRateLimit, clearAttempts, recordFailedAttempt } from '$lib/server/rateLimit';
import { createNotification } from '$lib/server/notifications';

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

		const userId = await resetPasswordWithRecoveryKey(recoveryKey, password);
		if (!userId) {
			recordFailedAttempt(ip);
			return fail(400, { error: 'That recovery key is incorrect or has already been used.' });
		}

		clearAttempts(ip);

		// A durable record of this, not just the inline confirmation below —
		// this flow runs while logged out, so the account owner (if this
		// wasn't them) only ever sees it once they next log in.
		await createNotification(
			userId,
			'password_reset',
			'Your password was reset using a recovery key.'
		);

		// Issue the next key right here instead of sending them off to Settings
		// to remember to do it later — the old key is already spent, so this is
		// the one moment we know for certain they need a new one, and they're
		// already looking right at this screen for it.
		const newRecoveryKey = await generateRecoveryKey(userId);
		return { success: true, newRecoveryKey };
	}
};
