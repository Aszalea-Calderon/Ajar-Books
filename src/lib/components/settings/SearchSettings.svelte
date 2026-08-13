<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';

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
