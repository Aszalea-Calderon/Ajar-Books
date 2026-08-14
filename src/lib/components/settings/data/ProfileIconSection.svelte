<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';

	let { avatarEmoji }: { avatarEmoji: string | null } = $props();

	// A curated, reading-themed set rather than a full emoji picker — keeps
	// the grid short and on-brand, same reasoning as the curated font list.
	const EMOJI_OPTIONS = ['📚', '📖', '🔖', '🦉', '🐉', '🌙', '☕', '✨', '🍂', '🌊', '🦋', '🐢'];

	let selected = $state(avatarEmoji);
	let saved = $state(false);
	let formEl = $state<HTMLFormElement>();

	// requestSubmit() reads the hidden input's live DOM value — it must run
	// after Svelte has flushed `selected`'s new value into that input via
	// tick(), or the submit races ahead and ships the previous value.
	async function pick(emoji: string | null) {
		selected = emoji;
		saved = false;
		await tick();
		formEl?.requestSubmit();
	}
</script>

<h3>Profile Icon</h3>
<p class="settings-hint">Shown in the top-right avatar instead of your username's first letter.</p>
<form
	bind:this={formEl}
	method="POST"
	action="/profile?/updateAvatarEmoji"
	use:enhance={() => {
		return async ({ update, result }) => {
			await update();
			if (result.type === 'success') saved = true;
		};
	}}
>
	<input type="hidden" name="avatarEmoji" value={selected ?? ''} />
	<div class="theme-options">
		<button
			type="button"
			class="theme-option profile-icon-option"
			class:theme-option--selected={selected === null}
			onclick={() => pick(null)}
		>
			Aa
		</button>
		{#each EMOJI_OPTIONS as emoji (emoji)}
			<button
				type="button"
				class="theme-option profile-icon-option"
				class:theme-option--selected={selected === emoji}
				onclick={() => pick(emoji)}
				aria-label="Use {emoji} as profile icon"
			>
				{emoji}
			</button>
		{/each}
	</div>
	{#if saved}
		<p class="settings-hint settings-hint--success">Saved.</p>
	{/if}
</form>
