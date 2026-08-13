import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { notifications, users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth';
import {
	createNotification,
	getUnreadCount,
	listNotifications,
	markAllRead
} from './notifications';

async function seedUser(username = 'testuser') {
	const [user] = await db
		.insert(users)
		.values({ username, passwordHash: hashPassword('password') })
		.returning();
	return user;
}

describe('notifications', () => {
	beforeEach(async () => {
		await db.delete(notifications);
		await db.delete(users);
	});

	it('starts empty with zero unread', async () => {
		const user = await seedUser();
		expect(await listNotifications(user.id)).toEqual([]);
		expect(await getUnreadCount(user.id)).toBe(0);
	});

	it('lists newest first and counts unread', async () => {
		const user = await seedUser();
		await createNotification(user.id, 'import_finished', 'Import finished — 3 added, 0 merged.');
		await createNotification(user.id, 'backfill_complete', 'Backfill complete — updated 2 books.');

		const list = await listNotifications(user.id);
		expect(list.map((n) => n.type)).toEqual(['backfill_complete', 'import_finished']);
		expect(list.every((n) => n.readAt === null)).toBe(true);
		expect(await getUnreadCount(user.id)).toBe(2);
	});

	it('markAllRead clears unread count without deleting anything', async () => {
		const user = await seedUser();
		await createNotification(user.id, 'password_reset', 'Your password was reset.');

		await markAllRead(user.id);

		expect(await getUnreadCount(user.id)).toBe(0);
		const list = await listNotifications(user.id);
		expect(list).toHaveLength(1);
		expect(list[0].readAt).not.toBeNull();
	});

	it('only ever surfaces the current user\'s own notifications', async () => {
		const userA = await seedUser('alice');
		const userB = await seedUser('bob');
		await createNotification(userA.id, 'password_reset', "Alice's notification");

		expect(await listNotifications(userB.id)).toEqual([]);
		expect(await getUnreadCount(userB.id)).toBe(0);
	});
});
