import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { notifications, users } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth';
import {
	clearNotifications,
	createNotification,
	deleteNotification,
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

	it('deleteNotification removes just the one notification', async () => {
		const user = await seedUser();
		await createNotification(user.id, 'password_reset', 'first');
		await createNotification(user.id, 'backfill_complete', 'second');
		const [target] = await listNotifications(user.id);

		await deleteNotification(user.id, target.id);

		const remaining = await listNotifications(user.id);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).not.toBe(target.id);
	});

	it('deleteNotification is scoped to the owning user', async () => {
		const userA = await seedUser('alice');
		const userB = await seedUser('bob');
		await createNotification(userA.id, 'password_reset', "Alice's notification");
		const [notification] = await listNotifications(userA.id);

		await deleteNotification(userB.id, notification.id);

		expect(await listNotifications(userA.id)).toHaveLength(1);
	});

	it('clearNotifications removes everything for that user only', async () => {
		const userA = await seedUser('alice');
		const userB = await seedUser('bob');
		await createNotification(userA.id, 'password_reset', "Alice's notification");
		await createNotification(userB.id, 'password_reset', "Bob's notification");

		await clearNotifications(userA.id);

		expect(await listNotifications(userA.id)).toEqual([]);
		expect(await listNotifications(userB.id)).toHaveLength(1);
	});
});
