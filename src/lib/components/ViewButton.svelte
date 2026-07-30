<script lang="ts">
	import { viewModeState, setViewMode, type ViewMode } from '$lib/client/viewMode.svelte';
	import { clickOutside } from '$lib/clickOutside';

	// Table is only offered where a table rendering actually exists (My
	// Library) — Search's result cards don't have per-row personal metadata
	// (status/rating/format) to make a table worth building there yet.
	let { showTable = false }: { showTable?: boolean } = $props();

	let open = $state(false);

	function select(mode: ViewMode) {
		setViewMode(mode);
		open = false;
	}
</script>

<div class="view-button" use:clickOutside={() => (open = false)}>
	<button
		type="button"
		class="view-button__trigger"
		aria-expanded={open}
		aria-haspopup="true"
		aria-label="Change view"
		title="Change view"
		onclick={() => (open = !open)}
	>
		<svg
			viewBox="0 0 24 24"
			width="18"
			height="18"
			aria-hidden="true"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	</button>
	{#if open}
		<div class="view-button__panel">
			<button
				type="button"
				class="view-button__option"
				class:view-button__option--active={viewModeState.current === 'cards'}
				onclick={() => select('cards')}
			>
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<rect x="14" y="14" width="7" height="7" rx="1" />
				</svg>
				Cards
			</button>
			<button
				type="button"
				class="view-button__option"
				class:view-button__option--active={viewModeState.current === 'list'}
				onclick={() => select('list')}
			>
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<line x1="8" y1="6" x2="21" y2="6" />
					<line x1="8" y1="12" x2="21" y2="12" />
					<line x1="8" y1="18" x2="21" y2="18" />
					<line x1="3" y1="6" x2="3.01" y2="6" />
					<line x1="3" y1="12" x2="3.01" y2="12" />
					<line x1="3" y1="18" x2="3.01" y2="18" />
				</svg>
				List
			</button>
			{#if showTable}
				<button
					type="button"
					class="view-button__option"
					class:view-button__option--active={viewModeState.current === 'table'}
					onclick={() => select('table')}
				>
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						aria-hidden="true"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="3" y="3" width="18" height="18" rx="1" />
						<line x1="3" y1="9" x2="21" y2="9" />
						<line x1="3" y1="15" x2="21" y2="15" />
						<line x1="9" y1="3" x2="9" y2="21" />
						<line x1="15" y1="3" x2="15" y2="21" />
					</svg>
					Table
				</button>
			{/if}
		</div>
	{/if}
</div>
