<script lang="ts">
	import { viewModeState, setViewMode } from '$lib/client/viewMode.svelte';

	// Table is only offered where a table rendering actually exists (My
	// Library) — Search's result cards don't have per-row personal metadata
	// (status/rating/format) to make a table worth building there yet.
	let { showTable = false }: { showTable?: boolean } = $props();
</script>

<div class="view-toggle" role="group" aria-label="Switch view">
	<button
		type="button"
		class="view-toggle__option"
		class:view-toggle__option--active={viewModeState.current === 'cards'}
		onclick={() => setViewMode('cards')}
	>
		Cards
	</button>
	<button
		type="button"
		class="view-toggle__option"
		class:view-toggle__option--active={viewModeState.current === 'list'}
		onclick={() => setViewMode('list')}
	>
		List
	</button>
	{#if showTable}
		<button
			type="button"
			class="view-toggle__option"
			class:view-toggle__option--active={viewModeState.current === 'table'}
			onclick={() => setViewMode('table')}
		>
			Table
		</button>
	{/if}
</div>
