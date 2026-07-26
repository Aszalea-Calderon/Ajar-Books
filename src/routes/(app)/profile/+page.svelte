<script lang="ts">
	import SettingsModal from '$lib/components/SettingsModal.svelte';

	let settingsOpen = $state(false);
</script>

<svelte:head>
	<title>Profile — Ajar Books</title>
</svelte:head>

<div class="placeholder">
	<h2>Profile</h2>
	<p>Your favorites shelf and finished-books history are coming in Phase 5.</p>
	<button type="button" class="settings-trigger" onclick={() => (settingsOpen = true)}>
		Settings
	</button>
</div>

<SettingsModal bind:open={settingsOpen} />
