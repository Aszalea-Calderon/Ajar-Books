import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	generateRecoveryKey,
	hashPassword,
	hasRecoveryKey,
	resetPasswordWithRecoveryKey,
	verifyPassword
} from './auth';

async function seedUser() {
	const [user] = await db
		.insert(users)
		.values({ username: 'testuser', passwordHash: hashPassword('original-password') })
		.returning();
	return user;
}

describe('recovery key', () => {
	beforeEach(async () => {
		await db.delete(users);
	});

	it('has no recovery key until one is generated', async () => {
		const user = await seedUser();
		expect(await hasRecoveryKey(user.id)).toBe(false);
	});

	it('generates a key, formatted as four dash-separated groups', async () => {
		const user = await seedUser();
		const key = await generateRecoveryKey(user.id);

		expect(key).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
		expect(await hasRecoveryKey(user.id)).toBe(true);
	});

	it('never generates visually-confusable characters (0/O, 1/I/L)', async () => {
		const user = await seedUser();
		// Generate several keys to make a real coverage gap unlikely to hide.
		for (let i = 0; i < 20; i++) {
			const key = await generateRecoveryKey(user.id);
			expect(key).not.toMatch(/[01ILO]/);
		}
	});

	it('resets the password when given the correct key', async () => {
		const user = await seedUser();
		const key = await generateRecoveryKey(user.id);

		const ok = await resetPasswordWithRecoveryKey(key, 'brand-new-password');

		expect(ok).toBe(true);
		const [updated] = await db.select().from(users);
		expect(verifyPassword('brand-new-password', updated.passwordHash)).toBe(true);
		expect(verifyPassword('original-password', updated.passwordHash)).toBe(false);
	});

	it('is case-insensitive (typing a written-down key doesn\'t require exact case)', async () => {
		const user = await seedUser();
		const key = await generateRecoveryKey(user.id);

		const ok = await resetPasswordWithRecoveryKey(key.toLowerCase(), 'brand-new-password');

		expect(ok).toBe(true);
	});

	it('rejects an incorrect key and leaves the password unchanged', async () => {
		const user = await seedUser();
		await generateRecoveryKey(user.id);

		const ok = await resetPasswordWithRecoveryKey('WRONG-KEYX-ABCD-9999', 'brand-new-password');

		expect(ok).toBe(false);
		const [unchanged] = await db.select().from(users);
		expect(verifyPassword('original-password', unchanged.passwordHash)).toBe(true);
	});

	it('is single-use — the same key cannot reset the password twice', async () => {
		const user = await seedUser();
		const key = await generateRecoveryKey(user.id);

		const first = await resetPasswordWithRecoveryKey(key, 'first-new-password');
		const second = await resetPasswordWithRecoveryKey(key, 'second-new-password');

		expect(first).toBe(true);
		expect(second).toBe(false);
		expect(await hasRecoveryKey(user.id)).toBe(false);
	});

	it('rejects any key when none has ever been generated', async () => {
		await seedUser();
		const ok = await resetPasswordWithRecoveryKey('ABCD-EFGH-JKMN-PQRS', 'brand-new-password');
		expect(ok).toBe(false);
	});

	it('generating a new key invalidates the previous one', async () => {
		const user = await seedUser();
		const firstKey = await generateRecoveryKey(user.id);
		await generateRecoveryKey(user.id);

		const ok = await resetPasswordWithRecoveryKey(firstKey, 'brand-new-password');
		expect(ok).toBe(false);
	});
});
