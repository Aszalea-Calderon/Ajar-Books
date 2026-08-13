import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import {
	books,
	goals,
	importJobs,
	notifications,
	readingLogs,
	tags,
	userBookTags,
	userBooks,
	users
} from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth';
import { deleteAllLibraryData } from './deleteAllData';

async function seedEverything() {
	const [user] = await db
		.insert(users)
		.values({ username: 'testuser', passwordHash: hashPassword('password') })
		.returning();

	const [book] = await db.insert(books).values({ title: 'Dune', author: 'Frank Herbert' }).returning();
	const [userBook] = await db
		.insert(userBooks)
		.values({ bookId: book.id, status: 'reading' })
		.returning();
	const [tag] = await db.insert(tags).values({ type: 'genre', name: 'Science Fiction' }).returning();
	await db.insert(userBookTags).values({ userBookId: userBook.id, tagId: tag.id });
	await db.insert(readingLogs).values({ userBookId: userBook.id, pagesRead: 50 });
	await db.insert(goals).values({
		period: 'year',
		metric: 'books',
		target: 12,
		periodStart: new Date('2026-01-01'),
		periodEnd: new Date('2026-12-31')
	});
	await db.insert(importJobs).values({ userId: user.id, rows: [], total: 0 });
	await db.insert(notifications).values({
		userId: user.id,
		type: 'password_reset',
		message: 'test'
	});

	return user;
}

describe('deleteAllLibraryData', () => {
	beforeEach(async () => {
		await db.delete(notifications);
		await db.delete(importJobs);
		await db.delete(readingLogs);
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
		await db.delete(goals);
		await db.delete(users);
	});

	it('wipes every library table but leaves the account intact', async () => {
		const user = await seedEverything();

		await deleteAllLibraryData();

		expect(await db.select().from(books)).toEqual([]);
		expect(await db.select().from(userBooks)).toEqual([]);
		expect(await db.select().from(userBookTags)).toEqual([]);
		expect(await db.select().from(readingLogs)).toEqual([]);
		expect(await db.select().from(tags)).toEqual([]);
		expect(await db.select().from(goals)).toEqual([]);
		expect(await db.select().from(importJobs)).toEqual([]);
		expect(await db.select().from(notifications)).toEqual([]);

		const remainingUsers = await db.select().from(users);
		expect(remainingUsers).toHaveLength(1);
		expect(remainingUsers[0].id).toBe(user.id);
	});

	it('is safe to run again with nothing left to delete', async () => {
		await expect(deleteAllLibraryData()).resolves.toBeUndefined();
	});
});
