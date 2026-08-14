import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword } from './auth';
import { MAX_AVATAR_UPLOAD_BYTES, updateAvatarImage } from './avatar';

async function seedUser() {
	const [user] = await db
		.insert(users)
		.values({ username: 'testuser', passwordHash: hashPassword('original-password') })
		.returning();
	return user;
}

function testImage(width: number, height: number, format: 'png' | 'jpeg' | 'tiff' = 'png') {
	const image = sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } }
	});
	return image[format]().toBuffer();
}

function dataUriToBuffer(dataUri: string) {
	const base64 = dataUri.split(',')[1];
	return Buffer.from(base64, 'base64');
}

describe('updateAvatarImage', () => {
	beforeEach(async () => {
		await db.delete(users);
	});

	it('accepts a valid image, stores it as a PNG data URI, and clears avatarEmoji', async () => {
		const user = await seedUser();
		await db.update(users).set({ avatarEmoji: '📚' }).where(eq(users.id, user.id));

		const buffer = await testImage(400, 300);
		const result = await updateAvatarImage(user.id, buffer);

		expect(result).toBe('ok');
		const [updated] = await db.select().from(users).where(eq(users.id, user.id));
		expect(updated.avatarImage).toMatch(/^data:image\/png;base64,/);
		expect(updated.avatarEmoji).toBeNull();
	});

	it('crops non-square input to a 256x256 square', async () => {
		const user = await seedUser();
		const buffer = await testImage(800, 200);

		await updateAvatarImage(user.id, buffer);

		const [updated] = await db.select().from(users).where(eq(users.id, user.id));
		const metadata = await sharp(dataUriToBuffer(updated.avatarImage!)).metadata();
		expect(metadata.width).toBe(256);
		expect(metadata.height).toBe(256);
	});

	it('accepts a JPEG input, re-encoding it as PNG', async () => {
		const user = await seedUser();
		const buffer = await testImage(300, 300, 'jpeg');

		const result = await updateAvatarImage(user.id, buffer);

		expect(result).toBe('ok');
		const [updated] = await db.select().from(users).where(eq(users.id, user.id));
		expect(updated.avatarImage).toMatch(/^data:image\/png;base64,/);
	});

	it('rejects a format outside the allow-list (e.g. TIFF)', async () => {
		const user = await seedUser();
		const buffer = await testImage(300, 300, 'tiff');

		const result = await updateAvatarImage(user.id, buffer);

		expect(result).toBe('invalid-image');
		const [unchanged] = await db.select().from(users).where(eq(users.id, user.id));
		expect(unchanged.avatarImage).toBeNull();
	});

	it('rejects corrupt/non-image bytes', async () => {
		const user = await seedUser();
		const buffer = Buffer.from('this is not an image, just plain text bytes');

		const result = await updateAvatarImage(user.id, buffer);

		expect(result).toBe('invalid-image');
		const [unchanged] = await db.select().from(users).where(eq(users.id, user.id));
		expect(unchanged.avatarImage).toBeNull();
	});

	it('rejects a buffer over the size cap without touching the row', async () => {
		const user = await seedUser();
		const buffer = Buffer.alloc(MAX_AVATAR_UPLOAD_BYTES + 1);

		const result = await updateAvatarImage(user.id, buffer);

		expect(result).toBe('too-large');
		const [unchanged] = await db.select().from(users).where(eq(users.id, user.id));
		expect(unchanged.avatarImage).toBeNull();
	});

	it('rejects an empty buffer', async () => {
		const user = await seedUser();
		const result = await updateAvatarImage(user.id, Buffer.alloc(0));
		expect(result).toBe('too-large');
	});
});
