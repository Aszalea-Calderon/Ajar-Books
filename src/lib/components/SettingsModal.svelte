<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { themeState, setTheme, type Theme } from '$lib/client/theme.svelte';
	import { fontState, setFont, type Font } from '$lib/client/font.svelte';
	import { accentState, setAccent, resetAccent } from '$lib/client/accent.svelte';
	import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
	import type { TagType, TagWithUsage } from '$lib/server/books/tags';

	let {
		open = $bindable(false),
		googleBooksApiKey,
		languagePriority,
		manageableTags
	}: {
		open?: boolean;
		googleBooksApiKey: string | null;
		languagePriority: string;
		manageableTags: Record<TagType, TagWithUsage[]>;
	} = $props();

	let dialogEl: HTMLDialogElement;
	let section = $state<'themes' | 'fonts' | 'integrations' | 'tags' | 'data'>('themes');
	let justSaved = $state(false);
	let languageJustSaved = $state(false);

	const TAG_SECTIONS: { type: TagType; label: string }[] = [
		{ type: 'genre', label: 'Genre' },
		{ type: 'mood', label: 'Mood' },
		{ type: 'setting', label: 'Setting' }
	];

	function deleteTagConfirmMessage(tag: TagWithUsage) {
		return tag.usageCount > 0
			? `Delete the tag "${tag.name}"? It will be removed from ${tag.usageCount} ${tag.usageCount === 1 ? 'book' : 'books'}.`
			: `Delete the tag "${tag.name}"?`;
	}

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	const themes: { id: Theme; label: string }[] = [
		{ id: 'dark', label: 'Dark' },
		{ id: 'light', label: 'Light' }
	];

	const fonts: { id: Font; label: string }[] = [
		{ id: 'default', label: 'Default' },
		{ id: 'dyslexic', label: 'Dyslexia-friendly' }
	];

	let defaultAccent = $derived(themeState.current === 'light' ? '#1d5fa8' : '#4c8edb');

	function closeOnBackdropClick(event: MouseEvent) {
		if (event.target === dialogEl) open = false;
	}
</script>

<dialog
	bind:this={dialogEl}
	class="settings-modal"
	onclose={() => (open = false)}
	onclick={closeOnBackdropClick}
>
	<div class="settings-modal__header">
		<h2>Settings</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close settings"
			onclick={() => (open = false)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__body">
		<nav class="settings-modal__nav">
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'themes'}
				onclick={() => (section = 'themes')}
			>
				Themes
			</button>
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'fonts'}
				onclick={() => (section = 'fonts')}
			>
				Fonts
			</button>
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'integrations'}
				onclick={() => (section = 'integrations')}
			>
				Integrations
			</button>
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'tags'}
				onclick={() => (section = 'tags')}
			>
				Tags
			</button>
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'data'}
				onclick={() => (section = 'data')}
			>
				Data
			</button>
		</nav>
		<div class="settings-modal__content">
			{#if section === 'themes'}
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
					<button type="button" class="settings-trigger" onclick={resetAccent}>
						Reset to default
					</button>
				</div>
			{:else if section === 'fonts'}
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
			{:else if section === 'integrations'}
				<h3>Language Priority</h3>
				<p class="settings-hint">
					When a book has editions in multiple languages, search results prefer this language — it
					doesn't hide other-language editions, just ranks a matching one higher.
				</p>
				<form
					method="POST"
					action="/profile?/saveLanguagePriority"
					use:enhance={() => {
						languageJustSaved = false;
						return async ({ update }) => {
							await update();
							languageJustSaved = true;
						};
					}}
				>
					<div class="auth-field">
						<label for="languagePriority">Preferred language</label>
						<select
							id="languagePriority"
							name="languagePriority"
							value={languagePriority}
							onchange={(event) => {
								languageJustSaved = false;
								event.currentTarget.form?.requestSubmit();
							}}
						>
							{#each LANGUAGE_PRIORITY_OPTIONS as option (option.code)}
								<option value={option.code}>{option.label}</option>
							{/each}
						</select>
					</div>
					{#if languageJustSaved}
						<p class="settings-hint settings-hint--success">Saved.</p>
					{/if}
				</form>

				<h3>Google Books API Key</h3>
				<p class="settings-hint">
					Optional — widens search results and improves cover art. Get a free key from the <a
						href="https://console.cloud.google.com/apis/library/books.googleapis.com"
						target="_blank"
						rel="noreferrer">Google Cloud Console</a
					>. Stored in your database, only ever sent to Google's API.
				</p>
				<form
					method="POST"
					action="/profile?/saveGoogleBooksKey"
					use:enhance={() => {
						justSaved = false;
						return async ({ update }) => {
							await update();
							justSaved = true;
						};
					}}
				>
					<div class="auth-field">
						<label for="googleBooksApiKey">API Key</label>
						<input
							id="googleBooksApiKey"
							name="googleBooksApiKey"
							type="text"
							value={googleBooksApiKey ?? ''}
							placeholder="Not set"
							oninput={() => (justSaved = false)}
						/>
					</div>
					<button class="auth-submit" type="submit">Save</button>
					{#if justSaved}
						<p class="settings-hint settings-hint--success">Saved.</p>
					{/if}
				</form>
			{:else if section === 'tags'}
				<h3>Manage Tags</h3>
				<p class="settings-hint">
					Rename or delete genre, mood, and setting tags across your whole library. Renaming a tag
					to match an existing one merges the two together.
				</p>
				{#each TAG_SECTIONS as tagSection (tagSection.type)}
					<h4 class="manage-tags__type-label">{tagSection.label}</h4>
					{#if manageableTags[tagSection.type].length === 0}
						<p class="settings-hint">No {tagSection.label.toLowerCase()} tags yet.</p>
					{:else}
						<ul class="manage-tags__list">
							{#each manageableTags[tagSection.type] as tag (tag.id)}
								<li class="manage-tags__row">
									<form method="POST" action="/profile?/renameTag" use:enhance>
										<input type="hidden" name="tagId" value={tag.id} />
										<input
											class="manage-tags__name-input"
											name="name"
											value={tag.name}
											aria-label="Rename {tag.name}"
											onchange={(event) => event.currentTarget.form?.requestSubmit()}
										/>
									</form>
									<span class="manage-tags__usage">
										{tag.usageCount}
										{tag.usageCount === 1 ? 'book' : 'books'}
									</span>
									<form
										method="POST"
										action="/profile?/deleteTag"
										use:enhance={({ cancel }) => {
											if (!confirm(deleteTagConfirmMessage(tag))) cancel();
										}}
									>
										<input type="hidden" name="tagId" value={tag.id} />
										<button
											type="submit"
											class="manage-tags__delete"
											aria-label="Delete {tag.name}"
											title="Delete {tag.name}"
										>
											<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
												<path
													fill="currentColor"
													d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
												/>
											</svg>
										</button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				{/each}
			{:else}
				<h3>Your Data</h3>
				<p class="settings-hint">
					Download a full JSON snapshot of your library — every book, its tags, and its reading
					logs.
				</p>
				<a class="settings-trigger" href={resolve('/(app)/export')} download>Export your data</a>
			{/if}
		</div>
	</div>
</dialog>
