<script lang="ts">
	import { enhance } from '$app/forms';

	// Accepts the full BookStatus union (including 'added') even though only
	// the 4 options below are ever selectable — the caller is expected not to
	// render this at all while status is 'added' (see isUntouched on the book
	// detail page), so 'added' never actually matches a pill here.
	let {
		status,
		onReadingClick
	}: {
		status: 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf';
		onReadingClick: () => void;
	} = $props();
</script>

<div class="status-control">
	<form method="POST" action="?/setStatus" use:enhance>
		<input type="hidden" name="status" value="want_to_read" />
		<button
			type="submit"
			class="status-control__pill"
			class:status-control__pill--active={status === 'want_to_read'}
			disabled={status === 'want_to_read'}
		>
			Want to Read
		</button>
	</form>
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
