<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
	import { searchViewMode, profileViewMode, type ViewMode } from '$lib/client/viewMode.svelte';

	let { languagePriority }: { languagePriority: string } = $props();

	let selectedLanguage = $state(untrack(() => languagePriority));
	let languageJustSaved = $state(false);
	let languageFormEl = $state<HTMLFormElement>();

	async function handleLanguageChange(value: string) {
		selectedLanguage = value;
		languageJustSaved = false;
		// Wait for the hidden input's value to reflect the new selection
		// before submitting, since the form reads the live DOM value.
		await tick();
		languageFormEl?.requestSubmit();
	}

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
</script>

<h3>Language Priority</h3>
<p class="settings-hint">
	When a book has editions in multiple languages, search results prefer this language — it
	doesn't hide other-language editions, just ranks a matching one higher.
</p>
<form
	bind:this={languageFormEl}
	method="POST"
	action="/profile?/saveLanguagePriority"
	use:enhance={() => {
		return async ({ update }) => {
			await update();
			languageJustSaved = true;
		};
	}}
>
	<input type="hidden" name="languagePriority" value={selectedLanguage} />
	<div class="auth-field">
		<label for="languagePriorityTrigger">Preferred language</label>
		<Dropdown
			id="languagePriorityTrigger"
			value={selectedLanguage}
			options={LANGUAGE_PRIORITY_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
			ariaLabel="Preferred language"
			onChange={handleLanguageChange}
		/>
	</div>
	{#if languageJustSaved}
		<p class="settings-hint settings-hint--success">Saved.</p>
	{/if}
</form>

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
