<script lang="ts">
	import { enhance } from '$app/forms';

	// Accepts the full BookStatus union (including 'added') even though only
	// the 4 options below are ever selectable — the caller is expected not to
	// render this at all while status is 'added' (see isUntouched on the book
	// detail page), so 'added' never actually matches a pill here.
	let { status }: { status: 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf' } = $props();

	const options = [
		{ id: 'want_to_read', label: 'Want to Read' },
		{ id: 'reading', label: 'Currently Reading' },
		{ id: 'finished', label: 'Finished' },
		{ id: 'dnf', label: 'Did Not Finish' }
	] as const;
</script>

<div class="status-control">
	{#each options as o (o.id)}
		<form method="POST" action="?/setStatus" use:enhance>
			<input type="hidden" name="status" value={o.id} />
			<button
				type="submit"
				class="status-control__pill"
				class:status-control__pill--active={status === o.id}
				disabled={status === o.id}
			>
				{o.label}
			</button>
		</form>
	{/each}
</div>
