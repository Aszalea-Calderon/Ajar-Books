<script lang="ts">
	import { enhance } from '$app/forms';

	// Accepts the full BookStatus union (including 'added') even though only
	// the 4 pills below are ever selectable — 'added' never actually matches
	// any of them, which is deliberate: a freshly-added, never-touched book
	// shows every option as an equally-available first choice.
	let {
		status,
		resetConfirmMessage,
		onReadingClick,
		onFinishedClick
	}: {
		status: 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf';
		resetConfirmMessage: string;
		onReadingClick: () => void;
		onFinishedClick: () => void;
	} = $props();

	// Clicking an already-active Currently Reading/Finished/DNF pill again
	// resets progress (same confirm-gated action as the dedicated reset
	// button) rather than doing nothing — Want to Read has its own lighter
	// untoggle instead, since there's no progress/format/rating to lose yet.
	// Cancelling via enhance's own `cancel()` — not `onsubmit` + preventDefault,
	// which doesn't stop enhance's own fetch-based submission once it's
	// already begun (confirmed live: cancelling the confirm() still deleted).
	function confirmReset({ cancel }: { cancel: () => void }) {
		if (!confirm(resetConfirmMessage)) cancel();
	}
</script>

<div class="status-control">
	{#if status === 'want_to_read'}
		<form method="POST" action="?/untoggleWantToRead" use:enhance>
			<button type="submit" class="status-control__pill status-control__pill--active">
				Want to Read
			</button>
		</form>
	{:else}
		<form method="POST" action="?/setStatus" use:enhance>
			<input type="hidden" name="status" value="want_to_read" />
			<button type="submit" class="status-control__pill">Want to Read</button>
		</form>
	{/if}

	{#if status === 'reading'}
		<form method="POST" action="?/removeBook" use:enhance={confirmReset}>
			<button type="submit" class="status-control__pill status-control__pill--active">
				Currently Reading
			</button>
		</form>
	{:else}
		<button type="button" class="status-control__pill" onclick={onReadingClick}>
			Currently Reading
		</button>
	{/if}

	{#if status === 'finished'}
		<form method="POST" action="?/removeBook" use:enhance={confirmReset}>
			<button type="submit" class="status-control__pill status-control__pill--active">
				Finished
			</button>
		</form>
	{:else}
		<button type="button" class="status-control__pill" onclick={onFinishedClick}>Finished</button>
	{/if}

	{#if status === 'dnf'}
		<form method="POST" action="?/removeBook" use:enhance={confirmReset}>
			<button type="submit" class="status-control__pill status-control__pill--active">
				Did Not Finish
			</button>
		</form>
	{:else}
		<form method="POST" action="?/setStatus" use:enhance>
			<input type="hidden" name="status" value="dnf" />
			<button type="submit" class="status-control__pill">Did Not Finish</button>
		</form>
	{/if}
</div>
