import { db } from '$lib/server/db';
import { books, goals, importJobs, notifications, tags } from '$lib/server/db/schema';

/**
 * Wipes all reading-library data — every book, tag, goal, import job, and
 * notification — while leaving the account itself (users/sessions/settings)
 * untouched, so the user stays logged in afterward. Deleting `books` alone
 * cascades through userBooks -> userBookTags/readingLogs (all
 * `onDelete: 'cascade'`), so those never need deleting directly.
 */
export async function deleteAllLibraryData(): Promise<void> {
	await db.delete(books);
	await db.delete(tags);
	await db.delete(goals);
	await db.delete(importJobs);
	await db.delete(notifications);
}
