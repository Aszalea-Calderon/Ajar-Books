<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import DisplaySettings from '$lib/components/settings/DisplaySettings.svelte';
	import SearchSettings from '$lib/components/settings/SearchSettings.svelte';
	import IntegrationsSettings from '$lib/components/settings/IntegrationsSettings.svelte';
	import TagsSettings from '$lib/components/settings/TagsSettings.svelte';
	import DataSettings from '$lib/components/settings/DataSettings.svelte';
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
		untrack(() => (page.url.searchParams.get('section') as SettingsSection | null) ?? 'themes')
	);

	function selectSection(next: SettingsSection) {
		section = next;
		const params = new SvelteURLSearchParams(page.url.search);
		params.set('section', next);
		goto(resolve(`/settings?${params.toString()}`), { keepFocus: true, noScroll: true });
	}

	// Shared confirm-modal state — Tags (delete tag) and Data (delete all my
	// data) both need a destructive-action confirmation gate on a form
	// submit, so one instance here serves both rather than each owning its
	// own ConfirmModal.
	let pendingConfirm = $state<{
		form: HTMLFormElement;
		message: string;
		label: string;
		confirmText?: string;
	} | null>(null);

	function requestConfirm(
		event: MouseEvent,
		message: string,
		label = 'Confirm',
		confirmText?: string
	) {
		const form = (event.currentTarget as HTMLElement).closest('form');
		if (form) pendingConfirm = { form, message, label, confirmText };
	}

	function confirmPendingSubmit() {
		pendingConfirm?.form.requestSubmit();
		pendingConfirm = null;
	}
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
				<DisplaySettings customThemes={data.customThemes} onRequestConfirm={requestConfirm} />
			{:else if section === 'search'}
				<SearchSettings languagePriority={data.languagePriority} />
			{:else if section === 'integrations'}
				<IntegrationsSettings googleBooksApiKey={data.googleBooksApiKey} />
			{:else if section === 'tags'}
				<TagsSettings manageableTags={data.manageableTags} onRequestConfirm={requestConfirm} />
			{:else}
				<DataSettings
					hasRecoveryKey={data.hasRecoveryKey}
					username={data.user?.username ?? ''}
					onRequestConfirm={requestConfirm}
				/>
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
