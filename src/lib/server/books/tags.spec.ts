import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { books, tags, userBookTags, userBooks } from '$lib/server/db/schema';
import { addTag, getSuggestedTagNames, getTagsForUserBook, removeTag } from './tags';

async function seedUserBook() {
	const [book] = await db.insert(books).values({ title: 'Test Book' }).returning();
	const [userBook] = await db.insert(userBooks).values({ bookId: book.id }).returning();
	return userBook.id;
}

describe('addTag / getTagsForUserBook', () => {
	beforeEach(async () => {
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
	});

	it('adds a tag and it shows up for that book and type', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', 'Heavy');

		const moodTags = await getTagsForUserBook(userBookId, 'mood');
		expect(moodTags.map((t) => t.name)).toEqual(['Heavy']);
	});

	it('trims whitespace from the tag name', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', '  Heavy  ');

		const moodTags = await getTagsForUserBook(userBookId, 'mood');
		expect(moodTags.map((t) => t.name)).toEqual(['Heavy']);
	});

	it('is a no-op for a blank/whitespace-only name', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', '   ');

		expect(await getTagsForUserBook(userBookId, 'mood')).toEqual([]);
		expect(await db.select().from(tags)).toEqual([]);
	});

	it('reuses the same underlying tag row across two different books', async () => {
		const bookA = await seedUserBook();
		const bookB = await seedUserBook();

		await addTag(bookA, 'genre', 'Fantasy');
		await addTag(bookB, 'genre', 'Fantasy');

		const allTagRows = await db.select().from(tags);
		expect(allTagRows).toHaveLength(1);
	});

	it('does not create a duplicate link when the same tag is added twice to the same book', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'genre', 'Fantasy');
		await addTag(userBookId, 'genre', 'Fantasy');

		const genreTags = await getTagsForUserBook(userBookId, 'genre');
		expect(genreTags).toHaveLength(1);
	});

	it('keeps genre/mood/setting namespaces independent for the same tag name', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'genre', 'Historical');
		await addTag(userBookId, 'mood', 'Historical');

		const [genreTags, moodTags] = await Promise.all([
			getTagsForUserBook(userBookId, 'genre'),
			getTagsForUserBook(userBookId, 'mood')
		]);
		expect(genreTags).toHaveLength(1);
		expect(moodTags).toHaveLength(1);
		// Two distinct tag rows, one per type, despite the identical name.
		expect(await db.select().from(tags)).toHaveLength(2);
	});

	it('only returns tags of the requested type for a book tagged across multiple types', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'genre', 'Fantasy');
		await addTag(userBookId, 'mood', 'Heavy');
		await addTag(userBookId, 'setting', 'Rural Idaho');

		expect((await getTagsForUserBook(userBookId, 'genre')).map((t) => t.name)).toEqual(['Fantasy']);
		expect((await getTagsForUserBook(userBookId, 'mood')).map((t) => t.name)).toEqual(['Heavy']);
		expect((await getTagsForUserBook(userBookId, 'setting')).map((t) => t.name)).toEqual([
			'Rural Idaho'
		]);
	});
});

describe('removeTag', () => {
	beforeEach(async () => {
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
	});

	it('removes the tag from the book', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', 'Heavy');
		const [tag] = await getTagsForUserBook(userBookId, 'mood');

		await removeTag(userBookId, tag.id);

		expect(await getTagsForUserBook(userBookId, 'mood')).toEqual([]);
	});

	it('does not delete the underlying tag, so it stays available as a suggestion for other books', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', 'Heavy');
		const [tag] = await getTagsForUserBook(userBookId, 'mood');

		await removeTag(userBookId, tag.id);

		const suggestions = await getSuggestedTagNames('mood');
		expect(suggestions).toContain('Heavy');
	});

	it('does not affect other books that also have the same tag', async () => {
		const bookA = await seedUserBook();
		const bookB = await seedUserBook();
		await addTag(bookA, 'genre', 'Fantasy');
		await addTag(bookB, 'genre', 'Fantasy');
		const [tag] = await getTagsForUserBook(bookA, 'genre');

		await removeTag(bookA, tag.id);

		expect(await getTagsForUserBook(bookA, 'genre')).toEqual([]);
		expect((await getTagsForUserBook(bookB, 'genre')).map((t) => t.name)).toEqual(['Fantasy']);
	});
});

describe('getSuggestedTagNames', () => {
	beforeEach(async () => {
		await db.delete(userBookTags);
		await db.delete(userBooks);
		await db.delete(books);
		await db.delete(tags);
	});

	it('includes the full canonical genre list even with no history', async () => {
		const suggestions = await getSuggestedTagNames('genre');
		expect(suggestions).toContain('Fantasy');
		expect(suggestions).toContain('Nonfiction');
	});

	it('includes previously-used custom genre names alongside the canonical list', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'genre', 'Cyberpunk');

		const suggestions = await getSuggestedTagNames('genre');
		expect(suggestions).toContain('Cyberpunk');
		expect(suggestions).toContain('Fantasy');
	});

	it('for mood/setting, only returns previously-used names (no canonical list)', async () => {
		const userBookId = await seedUserBook();
		await addTag(userBookId, 'mood', 'Heavy');

		expect(await getSuggestedTagNames('mood')).toEqual(['Heavy']);
	});
});
