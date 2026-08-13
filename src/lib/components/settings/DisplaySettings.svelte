<script lang="ts">
	import { themeState, setTheme, type Theme } from '$lib/client/theme.svelte';
	import { fontState, setFont, type Font } from '$lib/client/font.svelte';
	import { accentState, setAccent, resetAccent } from '$lib/client/accent.svelte';
	import {
		backgroundTextureState,
		setBackgroundTexture,
		type BackgroundTexture
	} from '$lib/client/backgroundTexture.svelte';
	import { searchViewMode, profileViewMode, type ViewMode } from '$lib/client/viewMode.svelte';

	const themes: { id: Theme; label: string }[] = [
		{ id: 'dark', label: 'Dark' },
		{ id: 'light', label: 'Light' }
	];

	const fonts: { id: Font; label: string }[] = [
		{ id: 'default', label: 'Default' },
		{ id: 'dyslexic', label: 'Dyslexia-friendly' }
	];

	const backgroundTextures: { id: BackgroundTexture; label: string }[] = [
		{ id: 'dotted', label: 'Dotted' },
		{ id: 'none', label: 'None' }
	];

	// Search and My Library each keep their own view-mode preference (see
	// viewMode.svelte.ts) — someone might want one dense (table) and the
	// other visual (cards).
	const viewModeOptions: { id: ViewMode; label: string }[] = [
		{ id: 'cards', label: 'Cards' },
		{ id: 'list', label: 'List' },
		{ id: 'table', label: 'Table' }
	];
	// My Library alone also offers Shelf — Search shows remote/unowned
	// results, which a 3D shelf of "your books" doesn't make sense for.
	const profileViewModeOptions: { id: ViewMode; label: string }[] = [
		...viewModeOptions,
		{ id: 'shelf', label: 'Shelf' }
	];

	let defaultAccent = $derived(themeState.current === 'light' ? '#1d5fa8' : '#4c8edb');
</script>

<h3>Theme</h3>
<div class="theme-options">
	{#each themes as t (t.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={themeState.current === t.id}
			onclick={() => setTheme(t.id)}
		>
			<span class="theme-swatch theme-swatch--{t.id}"></span>
			{t.label}
		</button>
	{/each}
</div>

<h3>Accent Color</h3>
<p class="settings-hint">
	Pick a custom accent color — it replaces the theme's default blue for buttons, links, and
	highlights everywhere in the app.
</p>
<div class="accent-picker">
	<input
		class="accent-picker__input"
		type="color"
		value={accentState.custom ?? defaultAccent}
		oninput={(event) => setAccent((event.currentTarget as HTMLInputElement).value)}
	/>
	<button type="button" class="settings-trigger" onclick={resetAccent}> Reset to default </button>
</div>

<h3>Background Pattern</h3>
<p class="settings-hint">
	A faint dotted texture behind every page — purely decorative, turn it off if you'd rather have a
	plain background.
</p>
<div class="theme-options">
	{#each backgroundTextures as bg (bg.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={backgroundTextureState.current === bg.id}
			onclick={() => setBackgroundTexture(bg.id)}
		>
			<span class="theme-swatch theme-swatch--bg-{bg.id}"></span>
			{bg.label}
		</button>
	{/each}
</div>

<h3>Font</h3>
<div class="theme-options">
	{#each fonts as f (f.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={fontState.current === f.id}
			onclick={() => setFont(f.id)}
		>
			<span class="font-preview font-preview--{f.id}">Aa</span>
			{f.label}
		</button>
	{/each}
</div>

<h3>Default View</h3>
<p class="settings-hint">
	Search and My Library each remember their own view — pick a starting point for each, or just
	switch it in-page any time.
</p>
<p class="settings-hint">Search Results</p>
<div class="pill-row">
	{#each viewModeOptions as v (v.id)}
		<button
			type="button"
			class="status-control__pill"
			class:status-control__pill--active={searchViewMode.state.current === v.id}
			onclick={() => searchViewMode.set(v.id)}
		>
			{v.label}
		</button>
	{/each}
</div>
<p class="settings-hint">My Library</p>
<div class="pill-row">
	{#each profileViewModeOptions as v (v.id)}
		<button
			type="button"
			class="status-control__pill"
			class:status-control__pill--active={profileViewMode.state.current === v.id}
			onclick={() => profileViewMode.set(v.id)}
		>
			{v.label}
		</button>
	{/each}
</div>
