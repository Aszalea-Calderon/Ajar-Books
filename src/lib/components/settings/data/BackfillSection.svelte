<script lang="ts">
	import { enhance } from '$app/forms';

	let backfillRunning = $state(false);
	let backfillResult = $state<number | null>(null);
</script>

<h3>Fix Missing Book Info</h3>
<p class="settings-hint">
	Backfill cover, description, and genre for books that never got them — mainly ones added via
	CSV import, which didn't fetch this until recently. Safe to run more than once; it only ever
	fills in what's still missing.
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
			This can take a few minutes for a large library — one request per missing book, sequential
			and rate-limited to stay a good citizen to Open Library.
		</p>
	{:else if backfillResult !== null}
		<p class="settings-hint settings-hint--success">
			{backfillResult === 0
				? 'Nothing needed backfilling.'
				: `Updated ${backfillResult} book${backfillResult === 1 ? '' : 's'}.`}
		</p>
	{/if}
</form>
