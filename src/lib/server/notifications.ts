import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export type NotificationType = (typeof notifications.$inferSelect)['type'];

export type Notification = {
	id: string;
	type: NotificationType;
	message: string;
	readAt: Date | null;
	createdAt: Date;
};

function toNotification(row: typeof notifications.$inferSelect): Notification {
	return {
		id: row.id,
		type: row.type,
		message: row.message,
		readAt: row.readAt,
		createdAt: row.createdAt
	};
}

export async function createNotification(
	userId: string,
	type: NotificationType,
	message: string
): Promise<void> {
	await db.insert(notifications).values({ userId, type, message });
}

// Most recent first, capped — this is a bell dropdown, not an inbox with its
// own paginated view.
const LIST_LIMIT = 20;

export async function listNotifications(userId: string): Promise<Notification[]> {
	const rows = await db
		.select()
		.from(notifications)
		.where(eq(notifications.userId, userId))
		// createdAt alone isn't a reliable tiebreaker for notifications created
		// back-to-back (millisecond resolution) — same fix as job.ts's
		// getLatestImportJob, for the same reason.
		.orderBy(desc(notifications.createdAt), desc(sql`rowid`))
		.limit(LIST_LIMIT);
	return rows.map(toNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
	const rows = await db
		.select({ id: notifications.id })
		.from(notifications)
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
	return rows.length;
}

// Mark-as-read is all-or-nothing on open, not per-item — this is a small
// bell dropdown, not an inbox that needs per-message triage.
export async function markAllRead(userId: string): Promise<void> {
	await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

// Scoped to userId so one account can't delete another's notification by
// guessing/enumerating ids — the route handler doesn't check ownership
// itself, this is the actual guard.
export async function deleteNotification(userId: string, id: string): Promise<void> {
	await db
		.delete(notifications)
		.where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function clearNotifications(userId: string): Promise<void> {
	await db.delete(notifications).where(eq(notifications.userId, userId));
}
