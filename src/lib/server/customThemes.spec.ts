import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/server/db';
import { customThemes } from '$lib/server/db/schema';
import { deleteCustomTheme, listCustomThemes, saveCustomTheme } from './customThemes';

function themeInput(overrides: Partial<Parameters<typeof saveCustomTheme>[0]> = {}) {
	return {
		name: 'Cozy Evening',
		theme: 'dark' as const,
		accentColor: '#8b4049',
		backgroundTexture: 'none' as const,
		font: 'default' as const,
		cardRadiusScale: 1.5,
		cardOpacity: 0.9,
		controlRadiusScale: 0.5,
		...overrides
	};
}

describe('customThemes', () => {
	beforeEach(async () => {
		await db.delete(customThemes);
	});

	it('starts empty', async () => {
		expect(await listCustomThemes()).toEqual([]);
	});

	it('saves a theme and lists it back with every field intact', async () => {
		const saved = await saveCustomTheme(themeInput());

		expect(saved).not.toBeNull();
		const list = await listCustomThemes();
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject(themeInput());
	});

	it('lists oldest first', async () => {
		await saveCustomTheme(themeInput({ name: 'First' }));
		await saveCustomTheme(themeInput({ name: 'Second' }));

		const list = await listCustomThemes();
		expect(list.map((t) => t.name)).toEqual(['First', 'Second']);
	});

	it('rejects an empty or whitespace-only name', async () => {
		const saved = await saveCustomTheme(themeInput({ name: '   ' }));

		expect(saved).toBeNull();
		expect(await listCustomThemes()).toEqual([]);
	});

	it('rejects a name already taken by another saved theme', async () => {
		await saveCustomTheme(themeInput({ name: 'Cozy Evening' }));
		const second = await saveCustomTheme(themeInput({ name: 'Cozy Evening' }));

		expect(second).toBeNull();
		expect(await listCustomThemes()).toHaveLength(1);
	});

	it('allows a null accent color (theme default)', async () => {
		const saved = await saveCustomTheme(themeInput({ accentColor: null }));

		expect(saved).not.toBeNull();
		const [row] = await listCustomThemes();
		expect(row.accentColor).toBeNull();
	});

	it('deletes a theme by id', async () => {
		const saved = await saveCustomTheme(themeInput());
		if (!saved) throw new Error('setup failed');

		await deleteCustomTheme(saved.id);

		expect(await listCustomThemes()).toEqual([]);
	});

	it('deleting a nonexistent id is a no-op', async () => {
		await expect(deleteCustomTheme('does-not-exist')).resolves.toBeUndefined();
	});
});
