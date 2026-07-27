<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmModal from './ConfirmModal.svelte';

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
	// Only one of the three reset forms is ever rendered at a time (each is
	// behind its own `{#if status === ...}` branch), so a single pending-form
	// reference is enough.
	let pendingResetForm = $state<HTMLFormElement | null>(null);

	function requestReset(event: MouseEvent) {
		pendingResetForm = (event.currentTarget as HTMLElement).closest('form');
	}

	function confirmResetSubmit() {
		pendingResetForm?.requestSubmit();
		pendingResetForm = null;
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
		<form method="POST" action="?/removeBook" use:enhance>
			<button
				type="button"
				class="status-control__pill status-control__pill--active"
				onclick={requestReset}
			>
				Currently Reading
			</button>
		</form>
	{:else}
		<button type="button" class="status-control__pill" onclick={onReadingClick}>
			Currently Reading
		</button>
	{/if}

	{#if status === 'finished'}
		<form method="POST" action="?/removeBook" use:enhance>
			<button
				type="button"
				class="status-control__pill status-control__pill--active"
				onclick={requestReset}
			>
				Finished
			</button>
		</form>
	{:else}
		<button type="button" class="status-control__pill" onclick={onFinishedClick}>Finished</button>
	{/if}

	{#if status === 'dnf'}
		<form method="POST" action="?/removeBook" use:enhance>
			<button
				type="button"
				class="status-control__pill status-control__pill--active"
				onclick={requestReset}
			>
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

<ConfirmModal
	open={!!pendingResetForm}
	message={resetConfirmMessage}
	confirmLabel="Reset"
	onConfirm={confirmResetSubmit}
	onCancel={() => (pendingResetForm = null)}
/>
