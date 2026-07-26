<script lang="ts">
	import { enhance } from '$app/forms';

	// Accepts the full BookStatus union (including 'added') even though only
	// the 4 pills below are ever selectable — 'added' never actually matches
	// any of them, which is deliberate: a freshly-added, never-touched book
	// shows every option as an equally-available first choice.
	let {
		status,
		onReadingClick
	}: {
		status: 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf';
		onReadingClick: () => void;
	} = $props();
</script>

<div class="status-control">
	{#if status === 'want_to_read'}
		<!-- Already active: clicking again untoggles back to the neutral
		     'added' state rather than doing nothing (see untoggleWantToRead). -->
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
	<button
		type="button"
		class="status-control__pill"
		class:status-control__pill--active={status === 'reading'}
		disabled={status === 'reading'}
		onclick={onReadingClick}
	>
		Currently Reading
	</button>
	<form method="POST" action="?/setStatus" use:enhance>
		<input type="hidden" name="status" value="finished" />
		<button
			type="submit"
			class="status-control__pill"
			class:status-control__pill--active={status === 'finished'}
			disabled={status === 'finished'}
		>
			Finished
		</button>
	</form>
	<form method="POST" action="?/setStatus" use:enhance>
		<input type="hidden" name="status" value="dnf" />
		<button
			type="submit"
			class="status-control__pill"
			class:status-control__pill--active={status === 'dnf'}
			disabled={status === 'dnf'}
		>
			Did Not Finish
		</button>
	</form>
</div>
