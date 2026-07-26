import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { tags, userBookTags } from '$lib/server/db/schema';
import { CANONICAL_GENRES } from './genreMapping';

export type TagType = 'genre' | 'mood' | 'setting';

export async function getTagsForUserBook(userBookId: string, type: TagType) {
	return db
		.select({ id: tags.id, name: tags.name })
		.from(userBookTags)
		.innerJoin(tags, eq(userBookTags.tagId, tags.id))
		.where(and(eq(userBookTags.userBookId, userBookId), eq(tags.type, type)));
}

async function findOrCreateTag(type: TagType, name: string) {
	const [existing] = await db
		.select()
		.from(tags)
		.where(and(eq(tags.type, type), eq(tags.name, name)));

	if (existing) return existing;

	const [created] = await db.insert(tags).values({ type, name }).returning();
	return created;
}

export async function addTag(userBookId: string, type: TagType, name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;

	const tag = await findOrCreateTag(type, trimmed);

	const [existingLink] = await db
		.select()
		.from(userBookTags)
		.where(and(eq(userBookTags.userBookId, userBookId), eq(userBookTags.tagId, tag.id)));

	if (!existingLink) {
		await db.insert(userBookTags).values({ userBookId, tagId: tag.id });
	}
}

export async function removeTag(userBookId: string, tagId: string) {
	await db
		.delete(userBookTags)
		.where(and(eq(userBookTags.userBookId, userBookId), eq(userBookTags.tagId, tagId)));
}

/**
 * Autocomplete suggestions: everything you've used before for this tag type,
 * plus (for genre only) the full curated list so unused canonical genres
 * still show up as options on a book with no matching history yet.
 */
export async function getSuggestedTagNames(type: TagType): Promise<string[]> {
	const rows = await db.selectDistinct({ name: tags.name }).from(tags).where(eq(tags.type, type));
	const used = rows.map((r) => r.name);

	if (type === 'genre') {
		return [...new Set([...CANONICAL_GENRES, ...used])].sort();
	}

	return used.sort();
}

export async function applyGenreSuggestions(userBookId: string, genres: string[]) {
	for (const genre of genres) {
		await addTag(userBookId, 'genre', genre);
	}
}
