<script lang="ts">
	import DrillDownShelf from './DrillDownShelf.svelte';
	import type { BookStatus } from '$lib/bookStatus';

	type DrillDownBook = {
		id: string;
		title: string;
		author: string | null;
		coverUrl: string | null;
		isbn: string | null;
		status: BookStatus;
		rating: number | null;
		genres: string[];
	};

	let {
		filter,
		books,
		onClear
	}: {
		filter: { type: 'genre' | 'author'; value: string } | null;
		books: DrillDownBook[];
		onClear: () => void;
	} = $props();

	let heading = $derived(
		filter ? (filter.type === 'genre' ? `Tagged "${filter.value}"` : `By ${filter.value}`) : null
	);
</script>

<aside class="insights-books-panel">
	{#if !filter}
		<p class="display-preview__heading">Books</p>
		<p class="settings-hint">Click a genre or author bar to see the books behind it, right here.</p>
	{:else}
		<div class="insights-books-panel__header">
			<p class="display-preview__heading">{heading}</p>
			<button type="button" class="settings-modal__close" aria-label="Clear selection" onclick={onClear}>
				×
			</button>
		</div>
		<DrillDownShelf {books} />
	{/if}
</aside>
