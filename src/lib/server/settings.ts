import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const SETTINGS_ID = 'app';

export async function getSettings() {
	const [row] = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID));
	return row ?? { id: SETTINGS_ID, googleBooksApiKey: null };
}

export async function updateSettings(patch: { googleBooksApiKey?: string | null }) {
	await db
		.insert(settings)
		.values({ id: SETTINGS_ID, ...patch })
		.onConflictDoUpdate({ target: settings.id, set: { ...patch, updatedAt: new Date() } });
}
