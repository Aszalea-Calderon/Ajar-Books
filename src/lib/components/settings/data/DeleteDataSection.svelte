<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		onRequestConfirm
	}: {
		onRequestConfirm: (event: MouseEvent, message: string, label?: string, confirmText?: string) => void;
	} = $props();

	let deleteDataRunning = $state(false);
	let dataDeleted = $state(false);
</script>

<h3>Delete My Data</h3>
<p class="settings-hint">
	Permanently deletes every book, tag, reading log, goal, and import record in your library — the
	same clean slate a brand-new account would have. Your account, login, and recovery key aren't
	touched, so you'll stay signed in. This can't be undone.
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
			onRequestConfirm(
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
