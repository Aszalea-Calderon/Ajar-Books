<script lang="ts">
	import DrillDownShelf from './DrillDownShelf.svelte';
	import ViewButton from '$lib/components/ViewButton.svelte';
	import { insightsViewMode } from '$lib/client/viewMode.svelte';
	import { coverSrc } from '$lib/coverPlaceholder';
	import type { BookStatus } from '$lib/bookStatus';
	import { resolve } from '$app/paths';
	import type { FictionCategory } from '$lib/server/insights/genreClassification';
	import type { ShelfOrientation } from '$lib/client/shelf/layout';

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
		books
	}: {
		filter: DrillDownFilter | null;
		books: DrillDownBook[];
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

	// Shelf-only display controls, folded into the same "eye" dropdown as the
	// Cards/List/Table/Shelf switcher (see the `extra` snippet below) rather
	// than a separate row of buttons above the shelf. Compact by default —
	// this panel is a narrow sidebar, not the full-page Profile shelf.
	let shelfOrientation = $state<ShelfOrientation>('cover');
	let shelfDensity = $state<'compact' | 'expanded'>('compact');

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

{#snippet shelfControls()}
	<hr class="view-button__divider" />
	<p class="view-button__section-label">Orientation</p>
	<button
		type="button"
		class="view-button__option"
		class:view-button__option--active={shelfOrientation === 'cover'}
		onclick={() => (shelfOrientation = 'cover')}
	>
		Covers
	</button>
	<button
		type="button"
		class="view-button__option"
		class:view-button__option--active={shelfOrientation === 'spine'}
		onclick={() => (shelfOrientation = 'spine')}
	>
		Spines
	</button>
	<p class="view-button__section-label">Size</p>
	<button
		type="button"
		class="view-button__option"
		class:view-button__option--active={shelfDensity === 'compact'}
		onclick={() => (shelfDensity = 'compact')}
	>
		Compact
	</button>
	<button
		type="button"
		class="view-button__option"
		class:view-button__option--active={shelfDensity === 'expanded'}
		onclick={() => (shelfDensity = 'expanded')}
	>
		Expanded
	</button>
{/snippet}

<aside class="insights-books-panel">
	<div class="insights-books-panel__header">
		<p class="display-preview__heading">{heading ?? 'Books'}</p>
		<ViewButton
			mode={insightsViewMode.state.current}
			onSelect={insightsViewMode.set}
			showTable
			showShelf
			extra={insightsViewMode.state.current === 'shelf' ? shelfControls : undefined}
		/>
	</div>
	{#if !filter}
		<div class="insights-books-panel__placeholder">
			<p class="settings-hint">Click any chart bar to see the books behind it, right here.</p>
		</div>
	{:else if books.length === 0}
		<p class="settings-hint">No books found.</p>
	{:else if insightsViewMode.state.current === 'shelf'}
		<DrillDownShelf {books} orientation={shelfOrientation} density={shelfDensity} />
	{:else if insightsViewMode.state.current === 'table'}
		<div class="data-table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th></th>
						<th>Title</th>
						<th>Author</th>
						<th>Rating</th>
					</tr>
				</thead>
				<tbody>
					{#each books as book (book.id)}
						<tr>
							<td class="data-table__cover-cell">
								<img class="data-table__cover" src={coverSrc(book.coverUrl, book.id, book.title)} alt="" />
							</td>
							<td><a href={resolve('/(app)/books/[id]', { id: book.id })}>{book.title}</a></td>
							<td>{book.author ?? '—'}</td>
							<td>{book.rating ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div
			class="search-results"
			class:search-results--cards={insightsViewMode.state.current === 'cards'}
		>
			{#each books as book (book.id)}
				<a class="search-result" href={resolve('/(app)/books/[id]', { id: book.id })}>
					<div class="search-result__cover-wrap">
						<img class="search-result__cover" src={coverSrc(book.coverUrl, book.id, book.title)} alt="" />
						{#if book.rating != null && insightsViewMode.state.current !== 'list'}
							<span class="search-result__rating-badge">★ {book.rating}</span>
						{/if}
					</div>
					<div class="search-result__info">
						<p class="search-result__title">{book.title}</p>
						{#if book.author}
							<p class="search-result__author">{book.author}</p>
						{/if}
					</div>
					{#if book.rating != null && insightsViewMode.state.current === 'list'}
						<span class="search-result__label">★ {book.rating}</span>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</aside>
