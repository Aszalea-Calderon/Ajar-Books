import { and, count, eq } from 'drizzle-orm';
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

export type TagWithUsage = { id: string; name: string; usageCount: number };

/**
 * Every tag of a given type with how many books currently use it — powers
 * Settings' "Manage Tags" list. Unlike getSuggestedTagNames (autocomplete,
 * includes the curated-but-unused genre list), this only ever shows tags
 * that actually exist as rows, since renaming/deleting an unused canonical
 * genre wouldn't do anything.
 */
export async function getAllTagsWithUsage(type: TagType): Promise<TagWithUsage[]> {
	const rows = await db
		.select({ id: tags.id, name: tags.name, usageCount: count(userBookTags.id) })
		.from(tags)
		.leftJoin(userBookTags, eq(userBookTags.tagId, tags.id))
		.where(eq(tags.type, type))
		.groupBy(tags.id);

	return rows
		.map((r) => ({ ...r, usageCount: Number(r.usageCount) }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Renames a tag across every book that uses it. If another tag of the same
 * type already has the target name, merges into it instead of erroring —
 * every link moves to the existing tag (dropping any that would duplicate
 * a link already there), and the old, now-empty tag row is removed. This
 * is the main tool for cleaning up typo'd/duplicate tags before Import
 * multiplies them across a much bigger batch of books.
 */
export async function renameTag(tagId: string, newName: string) {
	const trimmed = newName.trim();
	if (!trimmed) return;

	const [tag] = await db.select().from(tags).where(eq(tags.id, tagId));
	if (!tag || tag.name === trimmed) return;

	const [conflict] = await db
		.select()
		.from(tags)
		.where(and(eq(tags.type, tag.type), eq(tags.name, trimmed)));

	if (!conflict) {
		await db.update(tags).set({ name: trimmed }).where(eq(tags.id, tagId));
		return;
	}

	const links = await db.select().from(userBookTags).where(eq(userBookTags.tagId, tagId));

	for (const link of links) {
		const [alreadyLinked] = await db
			.select()
			.from(userBookTags)
			.where(
				and(eq(userBookTags.userBookId, link.userBookId), eq(userBookTags.tagId, conflict.id))
			);

		if (alreadyLinked) {
			await db.delete(userBookTags).where(eq(userBookTags.id, link.id));
		} else {
			await db.update(userBookTags).set({ tagId: conflict.id }).where(eq(userBookTags.id, link.id));
		}
	}

	await db.delete(tags).where(eq(tags.id, tagId));
}

/**
 * Deletes a tag from the master list entirely — cascades to remove it from
 * every book that had it (see userBookTags' onDelete: 'cascade').
 */
export async function deleteTagGlobally(tagId: string) {
	await db.delete(tags).where(eq(tags.id, tagId));
}
