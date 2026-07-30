<script lang="ts">
	import type { Snippet } from 'svelte';
	import { clickOutside } from '$lib/clickOutside';

	// Shared by Search and My Library so a change to the trigger/panel shell
	// (styling, positioning, outside-click/keyboard behavior) only has to be
	// made once — each page just supplies its own filter groups as children.
	let {
		activeCount = 0,
		children
	}: {
		activeCount?: number;
		children: Snippet;
	} = $props();

	let open = $state(false);
</script>

<div class="filter-button" use:clickOutside={() => (open = false)}>
	<button
		type="button"
		class="filter-button__trigger"
		aria-expanded={open}
		aria-haspopup="true"
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
			<path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
		</svg>
		Filter
		{#if activeCount > 0}
			<span class="filter-button__count">{activeCount}</span>
		{/if}
	</button>
	{#if open}
		<div class="filter-button__panel">
			{@render children()}
		</div>
	{/if}
</div>
