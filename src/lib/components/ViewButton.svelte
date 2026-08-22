<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ViewMode } from '$lib/client/viewMode.svelte';
	import { clickOutside } from '$lib/clickOutside';

	// Driven by whichever per-page view-mode store the caller passes in
	// (Search and My Library each have their own persisted preference —
	// see viewMode.svelte.ts) rather than importing a single shared store,
	// so this component works for either page.
	// Table is only offered where a table rendering actually exists (My
	// Library and Search both do now) — pass showTable={false} for a page
	// that doesn't. Shelf is My Library only (see viewMode.svelte.ts).
	let {
		mode,
		onSelect,
		showTable = false,
		showShelf = false,
		extra
	}: {
		mode: ViewMode;
		onSelect: (mode: ViewMode) => void;
		showTable?: boolean;
		showShelf?: boolean;
		// Extra content appended to the dropdown after the standard mode
		// options — e.g. Insights' drill-down panel folds its shelf
		// orientation/size controls in here instead of a separate control row.
		extra?: Snippet;
	} = $props();

	let open = $state(false);

	function select(next: ViewMode) {
		onSelect(next);
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
				class:view-button__option--active={mode === 'cards'}
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
				class:view-button__option--active={mode === 'list'}
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
					class:view-button__option--active={mode === 'table'}
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
			{#if showShelf}
				<button
					type="button"
					class="view-button__option"
					class:view-button__option--active={mode === 'shelf'}
					onclick={() => select('shelf')}
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
						<path d="M4 4v16M20 4v16M4 9h16M4 15h16" />
						<rect x="6" y="5" width="2" height="3.5" fill="currentColor" stroke="none" />
						<rect x="10" y="5" width="2" height="3.5" fill="currentColor" stroke="none" />
						<rect x="15" y="16" width="2" height="3.5" fill="currentColor" stroke="none" />
					</svg>
					Shelf
				</button>
			{/if}
			{#if extra}
				{@render extra()}
			{/if}
		</div>
	{/if}
</div>
