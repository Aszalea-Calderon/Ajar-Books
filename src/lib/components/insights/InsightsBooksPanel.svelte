<script lang="ts">
	import DrillDownShelf from './DrillDownShelf.svelte';
	import type { BookStatus } from '$lib/bookStatus';
	import type { FictionCategory } from '$lib/server/insights/genreClassification';

	type DrillDownBook = {
		id: string;
		title: string;
		author: string | null;
		coverUrl: string | null;
		isbn: string | null;
		status: BookStatus;
		rating: number | null;
		genres: string[];
		fictionCategory: FictionCategory;
		finishedYear: number | null;
		finishedMonth: string | null;
		publicationBucket: string | null;
	};

	type DrillDownFilter =
		| { type: 'genre'; value: string }
		| { type: 'author'; value: string }
		| { type: 'year'; value: number }
		| { type: 'month'; value: string }
		| { type: 'publicationBucket'; value: string }
		| { type: 'fiction'; value: FictionCategory };

	let {
		filter,
		books,
		onClear
	}: {
		filter: DrillDownFilter | null;
		books: DrillDownBook[];
		onClear: () => void;
	} = $props();

	const FICTION_LABELS: Record<FictionCategory, string> = {
		fiction: 'Fiction',
		nonfiction: 'Nonfiction',
		unclassified: 'Not yet tagged'
	};

	function monthLabel(month: string) {
		const [year, m] = month.split('-').map(Number);
		return new Date(year, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	let heading = $derived.by(() => {
		if (!filter) return null;
		switch (filter.type) {
			case 'genre':
				return `Tagged "${filter.value}"`;
			case 'author':
				return `By ${filter.value}`;
			case 'year':
				return `Finished in ${filter.value}`;
			case 'month':
				return `Finished in ${monthLabel(filter.value)}`;
			case 'publicationBucket':
				return `Published in the ${filter.value}`;
			case 'fiction':
				return FICTION_LABELS[filter.value];
		}
	});
</script>

<aside class="insights-books-panel">
	{#if !filter}
		<p class="display-preview__heading">Books</p>
		<div class="insights-books-panel__placeholder">
			<p class="settings-hint">Click any chart bar to see the books behind it, right here.</p>
		</div>
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
