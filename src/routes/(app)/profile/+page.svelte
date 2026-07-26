<script lang="ts">
	import { resolve } from '$app/paths';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let settingsOpen = $state(false);
</script>

<svelte:head>
	<title>Profile — Ajar Books</title>
</svelte:head>

<div class="placeholder">
	<h2>Profile</h2>
	<p>Your favorites shelf and finished-books history are coming in Phase 5.</p>
	<div class="profile__actions">
		<button type="button" class="settings-trigger" onclick={() => (settingsOpen = true)}>
			Settings
		</button>
		<a class="settings-trigger" href={resolve('/(app)/export')} download>Export your data</a>
	</div>
</div>

<SettingsModal bind:open={settingsOpen} googleBooksApiKey={data.googleBooksApiKey} />
