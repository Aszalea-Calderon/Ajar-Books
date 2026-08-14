<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';

	let {
		avatarEmoji,
		avatarImage
	}: { avatarEmoji: string | null; avatarImage: string | null } = $props();

	// A curated, varied set rather than a full emoji picker — keeps the grid
	// short and scannable, same reasoning as the curated font list. Reading-
	// themed first, then a broader general-purpose spread so there's
	// something for someone who'd rather not have a book icon at all.
	const EMOJI_OPTIONS = [
		'📚',
		'📖',
		'🔖',
		'🦉',
		'🐉',
		'🌙',
		'☕',
		'✨',
		'🍂',
		'🌊',
		'🦋',
		'🐢',
		'😊',
		'🐱',
		'🐶',
		'🦊',
		'🐨',
		'🐧',
		'🌸',
		'🌈',
		'🔥',
		'🌟',
		'🎨',
		'🎧'
	];

	let selectedEmoji = $state(avatarEmoji);
	let hasPhoto = $state(avatarImage !== null);
	// An instant client-side preview of the just-picked file, shown until the
	// upload round-trip resolves and the real (server-cropped) version takes
	// over via the avatarImage prop — otherwise the tile would flash back to
	// the old photo/icon for the moment the upload is in flight.
	let localPreviewUrl = $state<string | null>(null);

	let emojiSaved = $state(false);
	let photoError = $state<string | null>(null);

	let emojiFormEl = $state<HTMLFormElement>();
	let photoFormEl = $state<HTMLFormElement>();
	let fileInputEl = $state<HTMLInputElement>();

	// requestSubmit() reads the hidden input's live DOM value — it must run
	// after Svelte has flushed the new value into that input via tick(), or
	// the submit races ahead and ships the previous value.
	async function pickEmoji(emoji: string | null) {
		selectedEmoji = emoji;
		hasPhoto = false;
		photoError = null;
		emojiSaved = false;
		await tick();
		emojiFormEl?.requestSubmit();
	}

	function onFileChosen() {
		const file = fileInputEl?.files?.[0];
		if (!file) return;
		photoError = null;
		emojiSaved = false;
		selectedEmoji = null;
		hasPhoto = true;
		if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
		localPreviewUrl = URL.createObjectURL(file);
		photoFormEl?.requestSubmit();
	}

	// Shared by both forms' use:enhance — re-syncing from the props after
	// update() is simpler and more correct than manually guessing what
	// changed: on success they reflect the new pick, on failure they reflect
	// whatever was already there (the write never happened).
	function resync() {
		selectedEmoji = avatarEmoji;
		hasPhoto = avatarImage !== null;
		if (localPreviewUrl) {
			URL.revokeObjectURL(localPreviewUrl);
			localPreviewUrl = null;
		}
		if (fileInputEl) fileInputEl.value = '';
	}
</script>

<h3>Profile Icon</h3>
<p class="settings-hint">Shown in the top-right avatar instead of your username's first letter.</p>
<div class="theme-options">
	<form
		bind:this={photoFormEl}
		method="POST"
		action="/profile?/uploadAvatarImage"
		enctype="multipart/form-data"
		style="display: contents"
		use:enhance={() => {
			return async ({ update, result }) => {
				await update();
				photoError =
					result.type === 'failure' ? ((result.data?.avatarImageError as string) ?? 'Upload failed.') : null;
				resync();
			};
		}}
	>
		<label
			class="theme-option profile-icon-option profile-icon-option--photo"
			class:theme-option--selected={hasPhoto}
			title="Upload a photo"
		>
			{#if localPreviewUrl || avatarImage}
				<img class="profile-icon-option__preview" src={localPreviewUrl ?? avatarImage} alt="" />
			{:else}
				<span aria-hidden="true">+</span>
			{/if}
			<input
				bind:this={fileInputEl}
				type="file"
				name="avatarImage"
				accept="image/png,image/jpeg,image/webp,image/gif"
				class="profile-icon-option__file-input"
				aria-label="Upload a profile photo"
				onchange={onFileChosen}
			/>
		</label>
	</form>

	<form
		bind:this={emojiFormEl}
		method="POST"
		action="/profile?/updateAvatarEmoji"
		style="display: contents"
		use:enhance={() => {
			return async ({ update, result }) => {
				await update();
				emojiSaved = result.type === 'success';
				resync();
			};
		}}
	>
		<input type="hidden" name="avatarEmoji" value={selectedEmoji ?? ''} />
		<button
			type="button"
			class="theme-option profile-icon-option"
			class:theme-option--selected={!hasPhoto && selectedEmoji === null}
			onclick={() => pickEmoji(null)}
		>
			Aa
		</button>
		{#each EMOJI_OPTIONS as emoji (emoji)}
			<button
				type="button"
				class="theme-option profile-icon-option"
				class:theme-option--selected={!hasPhoto && selectedEmoji === emoji}
				onclick={() => pickEmoji(emoji)}
				aria-label="Use {emoji} as profile icon"
			>
				{emoji}
			</button>
		{/each}
	</form>
</div>
{#if photoError}
	<p class="settings-hint settings-hint--error">{photoError}</p>
{:else if emojiSaved}
	<p class="settings-hint settings-hint--success">Saved.</p>
{/if}
