import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customThemes } from '$lib/server/db/schema';

export type CustomTheme = typeof customThemes.$inferSelect;

export type CustomThemeInput = {
	name: string;
	theme: 'dark' | 'light';
	accentColor: string | null;
	backgroundTexture: 'dotted' | 'none';
	font: 'default' | 'dyslexic';
	cardRadiusScale: number;
	cardOpacity: number;
	controlRadiusScale: number;
	glassy: boolean;
	density: 'compact' | 'comfortable' | 'spacious';
	cardShadow: 'flat' | 'subtle' | 'pronounced';
	coverRadiusScale: number;
};

export async function listCustomThemes(): Promise<CustomTheme[]> {
	return db.select().from(customThemes).orderBy(customThemes.createdAt);
}

/** Returns null for an empty/whitespace-only name or one already taken (the `custom_themes.name` unique constraint). */
export async function saveCustomTheme(input: CustomThemeInput): Promise<CustomTheme | null> {
	const name = input.name.trim();
	if (!name) return null;
	try {
		const [row] = await db
			.insert(customThemes)
			.values({ ...input, name })
			.returning();
		return row;
	} catch {
		return null;
	}
}

export async function deleteCustomTheme(id: string): Promise<void> {
	await db.delete(customThemes).where(eq(customThemes.id, id));
}
