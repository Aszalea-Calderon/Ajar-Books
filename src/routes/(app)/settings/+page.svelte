<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import { themeState, setTheme, type Theme } from '$lib/client/theme.svelte';
	import { fontState, setFont, type Font } from '$lib/client/font.svelte';
	import { accentState, setAccent, resetAccent } from '$lib/client/accent.svelte';
	import {
		backgroundTextureState,
		setBackgroundTexture,
		type BackgroundTexture
	} from '$lib/client/backgroundTexture.svelte';
	import { searchViewMode, profileViewMode, type ViewMode } from '$lib/client/viewMode.svelte';
	import { LANGUAGE_PRIORITY_OPTIONS } from '$lib/languages';
	import type { TagType, TagWithUsage } from '$lib/server/books/tags';
	import type { PageData } from './$types';

	// Same data every (app) page already gets from the shared layout load
	// (googleBooksApiKey, languagePriority, manageableTags, hasRecoveryKey,
	// user) — this page needs no load of its own.
	let { data }: { data: PageData } = $props();

	type SettingsSection = 'themes' | 'search' | 'integrations' | 'tags' | 'data';
	const SECTIONS: { id: SettingsSection; label: string }[] = [
		{ id: 'themes', label: 'Display' },
		{ id: 'search', label: 'Search' },
		{ id: 'integrations', label: 'Integrations' },
		{ id: 'tags', label: 'Tags' },
		{ id: 'data', label: 'Data' }
	];

	// Deep-linkable via ?section=data (the recovery-key reminder banner uses
	// this), same query-param pattern Profile/Search use for their own
	// filters — a real URL per section, not just in-memory tab state.
	let section = $state<SettingsSection>(
		untrack(
			() => (page.url.searchParams.get('section') as SettingsSection | null) ?? 'themes'
		)
	);

	function selectSection(next: SettingsSection) {
		section = next;
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('section', next);
		goto(resolve(`/settings?${params.toString()}`), { keepFocus: true, noScroll: true });
	}

	let justSaved = $state(false);
	let backfillRunning = $state(false);
	let backfillResult = $state<number | null>(null);
	let languageJustSaved = $state(false);
	let recoveryKeyRunning = $state(false);
	let generatedRecoveryKey = $state<string | null>(null);
	let usernameSaved = $state(false);
	let usernameError = $state<string | null>(null);
	let passwordSaved = $state(false);
	let passwordError = $state<string | null>(null);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
	let deleteDataRunning = $state(false);
	let dataDeleted = $state(false);

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

	let pendingConfirm = $state<{
		form: HTMLFormElement;
		message: string;
		label: string;
		confirmText?: string;
	} | null>(null);

	function requestConfirm(event: MouseEvent, message: string, label = 'Confirm', confirmText?: string) {
		const form = (event.currentTarget as HTMLElement).closest('form');
		if (form) pendingConfirm = { form, message, label, confirmText };
	}

	function confirmPendingSubmit() {
		pendingConfirm?.form.requestSubmit();
		pendingConfirm = null;
	}

	let selectedLanguage = $state(untrack(() => data.languagePriority));
	let languageFormEl = $state<HTMLFormElement>();

	async function handleLanguageChange(value: string) {
		selectedLanguage = value;
		languageJustSaved = false;
		// Wait for the hidden input's value to reflect the new selection
		// before submitting, since the form reads the live DOM value.
		await tick();
		languageFormEl?.requestSubmit();
	}

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

<svelte:head>
	<title>Settings — Ajar Books</title>
</svelte:head>

<div class="settings-page">
	<div class="settings-page__header">
		<h1>Settings</h1>
	</div>
	<div class="settings-page__body">
		<nav class="settings-page__nav">
			{#each SECTIONS as s (s.id)}
				<button
					type="button"
					class="settings-page__nav-item"
					class:settings-page__nav-item--active={section === s.id}
					onclick={() => selectSection(s.id)}
				>
					{s.label}
				</button>
			{/each}
		</nav>
		<div class="settings-page__content">
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

				<h3>Background Pattern</h3>
				<p class="settings-hint">
					A faint dotted texture behind every page — purely decorative, turn it off if you'd rather
					have a plain background.
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
					Search and My Library each remember their own view — pick a starting point for each, or
					just switch it in-page any time.
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
			{:else if section === 'search'}
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
			{:else if section === 'integrations'}
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
							value={data.googleBooksApiKey ?? ''}
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
					{#if data.manageableTags[tagSection.type].length === 0}
						<p class="settings-hint">No {tagSection.label.toLowerCase()} tags yet.</p>
					{:else}
						<ul class="manage-tags__list">
							{#each data.manageableTags[tagSection.type] as tag (tag.id)}
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
									<form method="POST" action="/profile?/deleteTag" use:enhance>
										<input type="hidden" name="tagId" value={tag.id} />
										<button
											type="button"
											class="manage-tags__delete"
											aria-label="Delete {tag.name}"
											title="Delete {tag.name}"
											onclick={(event) =>
												requestConfirm(event, deleteTagConfirmMessage(tag), 'Delete')}
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
				<h3>Import</h3>
				<p class="settings-hint">
					Bring in your reading history from Goodreads, StoryGraph, or another CSV export.
				</p>
				<a class="settings-trigger" href={resolve('/(app)/import')}>Import your data</a>

				<h3>Your Data</h3>
				<p class="settings-hint">
					Download a full JSON snapshot of your library — every book, its tags, and its reading
					logs.
				</p>
				<a class="settings-trigger" href={resolve('/(app)/export')} download>Export your data</a>

				<h3>Fix Missing Book Info</h3>
				<p class="settings-hint">
					Backfill cover, description, and genre for books that never got them — mainly ones added
					via CSV import, which didn't fetch this until recently. Safe to run more than once; it
					only ever fills in what's still missing.
				</p>
				<form
					method="POST"
					action="/profile?/backfillMetadata"
					use:enhance={() => {
						backfillRunning = true;
						backfillResult = null;
						return async ({ update, result }) => {
							await update();
							backfillRunning = false;
							if (result.type === 'success' && result.data) {
								backfillResult = result.data.backfillCount as number;
							}
						};
					}}
				>
					<button class="settings-trigger" type="submit" disabled={backfillRunning}>
						{backfillRunning ? 'Backfilling…' : 'Backfill missing book info'}
					</button>
					{#if backfillRunning}
						<p class="settings-hint">
							This can take a few minutes for a large library — one request per missing book,
							sequential and rate-limited to stay a good citizen to Open Library.
						</p>
					{:else if backfillResult !== null}
						<p class="settings-hint settings-hint--success">
							{backfillResult === 0
								? 'Nothing needed backfilling.'
								: `Updated ${backfillResult} book${backfillResult === 1 ? '' : 's'}.`}
						</p>
					{/if}
				</form>

				<h3>Username</h3>
				<p class="settings-hint">Used to sign in — no email is on file for this app.</p>
				<form
					method="POST"
					action="/profile?/updateUsername"
					use:enhance={() => {
						usernameSaved = false;
						usernameError = null;
						return async ({ update, result }) => {
							await update();
							if (result.type === 'failure' && result.data?.usernameError) {
								usernameError = result.data.usernameError as string;
							} else if (result.type === 'success') {
								usernameSaved = true;
							}
						};
					}}
				>
					<div class="auth-field">
						<label for="username">Username</label>
						<input
							id="username"
							name="username"
							type="text"
							value={data.user?.username ?? ''}
							oninput={() => {
								usernameSaved = false;
								usernameError = null;
							}}
						/>
					</div>
					<button class="auth-submit" type="submit">Save</button>
					{#if usernameSaved}
						<p class="settings-hint settings-hint--success">Saved.</p>
					{:else if usernameError}
						<p class="settings-hint settings-hint--error">{usernameError}</p>
					{/if}
				</form>

				<h3>Change Password</h3>
				<p class="settings-hint">Requires your current password.</p>
				<form
					method="POST"
					action="/profile?/updatePassword"
					use:enhance={() => {
						passwordSaved = false;
						passwordError = null;
						return async ({ update, result }) => {
							await update();
							if (result.type === 'failure' && result.data?.passwordError) {
								passwordError = result.data.passwordError as string;
							} else if (result.type === 'success') {
								passwordSaved = true;
								currentPassword = '';
								newPassword = '';
								confirmNewPassword = '';
							}
						};
					}}
				>
					<PasswordField
						id="currentPassword"
						name="currentPassword"
						label="Current password"
						autocomplete="current-password"
						required
						bind:value={currentPassword}
					/>
					<PasswordField
						id="newPassword"
						name="newPassword"
						label="New password"
						autocomplete="new-password"
						required
						minlength={8}
						bind:value={newPassword}
					/>
					<PasswordField
						id="confirmNewPassword"
						name="confirmNewPassword"
						label="Confirm new password"
						autocomplete="new-password"
						required
						bind:value={confirmNewPassword}
					/>
					<button class="auth-submit" type="submit">Change password</button>
					{#if passwordSaved}
						<p class="settings-hint settings-hint--success">Password changed.</p>
					{:else if passwordError}
						<p class="settings-hint settings-hint--error">{passwordError}</p>
					{/if}
				</form>

				<h3>Account Recovery</h3>
				<p class="settings-hint">
					A recovery key lets you reset your password if you're ever locked out — this app has no
					email-based recovery, so it's the only way back in. Generating a new key invalidates any
					previous one.
				</p>
				{#if generatedRecoveryKey}
					<p class="settings-hint settings-hint--success">
						Your new recovery key — save it somewhere safe now, it won't be shown again:
					</p>
					<p class="recovery-key-display">{generatedRecoveryKey}</p>
				{:else if data.hasRecoveryKey}
					<p class="settings-hint">A recovery key is set.</p>
				{:else}
					<p class="settings-hint">No recovery key set yet.</p>
				{/if}
				<form
					method="POST"
					action="/profile?/generateRecoveryKey"
					use:enhance={() => {
						recoveryKeyRunning = true;
						return async ({ update, result }) => {
							await update();
							recoveryKeyRunning = false;
							if (result.type === 'success' && result.data?.recoveryKey) {
								generatedRecoveryKey = result.data.recoveryKey as string;
							}
						};
					}}
				>
					<button class="settings-trigger" type="submit" disabled={recoveryKeyRunning}>
						{recoveryKeyRunning
							? 'Generating…'
							: data.hasRecoveryKey || generatedRecoveryKey
								? 'Generate a new key'
								: 'Generate recovery key'}
					</button>
				</form>

				<h3>Delete My Data</h3>
				<p class="settings-hint">
					Permanently deletes every book, tag, reading log, goal, and import record in your
					library — the same clean slate a brand-new account would have. Your account, login, and
					recovery key aren't touched, so you'll stay signed in. This can't be undone.
				</p>
				<form
					method="POST"
					action="/profile?/deleteAllData"
					use:enhance={() => {
						deleteDataRunning = true;
						dataDeleted = false;
						return async ({ update }) => {
							await update();
							deleteDataRunning = false;
							dataDeleted = true;
						};
					}}
				>
					<button
						type="button"
						class="settings-trigger settings-trigger--danger"
						disabled={deleteDataRunning}
						onclick={(event) =>
							requestConfirm(
								event,
								"This permanently deletes every book, tag, reading log, goal, and import record in your library. Your account and login stay intact — you'll stay signed in. This can't be undone.",
								'Delete everything',
								'DELETE'
							)}
					>
						{deleteDataRunning ? 'Deleting…' : 'Delete all my data'}
					</button>
					{#if dataDeleted}
						<p class="settings-hint settings-hint--success">Your library data has been deleted.</p>
					{/if}
				</form>
			{/if}
		</div>
	</div>
</div>

<ConfirmModal
	open={!!pendingConfirm}
	message={pendingConfirm?.message ?? ''}
	confirmLabel={pendingConfirm?.label ?? 'Confirm'}
	confirmText={pendingConfirm?.confirmText}
	onConfirm={confirmPendingSubmit}
	onCancel={() => (pendingConfirm = null)}
/>
