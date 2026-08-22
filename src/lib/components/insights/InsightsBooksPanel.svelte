<script lang="ts">
	import DrillDownShelf from './DrillDownShelf.svelte';
	import ViewButton from '$lib/components/ViewButton.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
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

	// Search/sort within the currently selected set of books — same
	// search-bar look as Profile/Search, plus a sort control (this panel has
	// no table headers to click for Cards/List/Shelf the way Profile does).
	let searchQuery = $state('');

	type SortValue = 'title-asc' | 'title-desc' | 'author-asc' | 'rating-desc' | 'rating-asc';
	const SORT_OPTIONS: { value: SortValue; label: string }[] = [
		{ value: 'title-asc', label: 'Title (A–Z)' },
		{ value: 'title-desc', label: 'Title (Z–A)' },
		{ value: 'author-asc', label: 'Author (A–Z)' },
		{ value: 'rating-desc', label: 'Rating (High–Low)' },
		{ value: 'rating-asc', label: 'Rating (Low–High)' }
	];
	let sortValue = $state<SortValue>('title-asc');

	let visibleBooks = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const matched = query
			? books.filter(
					(book) =>
						book.title.toLowerCase().includes(query) || (book.author?.toLowerCase().includes(query) ?? false)
				)
			: books;

		const [key, dir] = sortValue.split('-') as ['title' | 'author' | 'rating', 'asc' | 'desc'];
		const sorted = [...matched].sort((a, b) => {
			let cmp: number;
			if (key === 'rating') {
				cmp = (a.rating ?? -1) - (b.rating ?? -1);
			} else {
				const av = key === 'author' ? (a.author ?? '') : a.title;
				const bv = key === 'author' ? (b.author ?? '') : b.title;
				cmp = av.toLowerCase().localeCompare(bv.toLowerCase());
			}
			return dir === 'asc' ? cmp : -cmp;
		});
		return sorted;
	});

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
	{:else}
		<div class="search-bar insights-books-panel__search-bar">
			<div class="search-bar__input-wrap">
				<svg
					class="search-bar__icon"
					viewBox="0 0 24 24"
					width="16"
					height="16"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<circle cx="11" cy="11" r="7" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input
					class="search-bar__input"
					type="search"
					placeholder="Search these books…"
					bind:value={searchQuery}
				/>
			</div>
			<Dropdown
				value={sortValue}
				options={SORT_OPTIONS}
				ariaLabel="Sort books"
				onChange={(v) => (sortValue = v as SortValue)}
			/>
		</div>
		{#if visibleBooks.length === 0}
			<p class="settings-hint">No books match "{searchQuery}".</p>
		{:else if insightsViewMode.state.current === 'shelf'}
			<DrillDownShelf books={visibleBooks} orientation={shelfOrientation} density={shelfDensity} />
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
						{#each visibleBooks as book (book.id)}
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
				{#each visibleBooks as book (book.id)}
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
	{/if}
</aside>
