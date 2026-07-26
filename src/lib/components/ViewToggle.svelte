<script lang="ts">
	import { viewModeState, setViewMode } from '$lib/client/viewMode.svelte';
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
</div>
