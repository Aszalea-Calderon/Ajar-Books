<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { viewModeState } from '$lib/client/viewMode.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const STATUS_TABS = [
		{ value: '', label: 'All' },
		{ value: 'reading', label: 'Currently Reading' },
		{ value: 'want_to_read', label: 'Want to Read' },
		{ value: 'finished', label: 'Finished' },
		{ value: 'dnf', label: 'Did Not Finish' }
	];

	function updateFilter(key: string, value: string | boolean) {
		const params = new SvelteURLSearchParams(page.url.search);
		if (!value) {
			params.delete(key);
		} else {
			params.set(key, value === true ? '1' : value);
		}
		goto(resolve(`/profile?${params.toString()}`), { keepFocus: true, noScroll: true });
	}

	// Debounced separately from updateFilter's other callers (status/genre/
	// mood/format are single-click dropdowns/pills — a text box firing a
	// navigation per keystroke would be much choppier).
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;
	function handleSearchInput(value: string) {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => updateFilter('q', value), 300);
	}

	const STATUS_TABLE_LABELS: Record<string, string> = {
		reading: 'Currently Reading',
		want_to_read: 'Want to Read',
		finished: 'Finished',
		dnf: 'Did Not Finish'
	};

	type SortKey = 'title' | 'author' | 'status' | 'rating' | 'format';
	let sortKey = $state<SortKey>('title');
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function sortValue(entry: PageData['books'][number], key: SortKey): string | number {
		switch (key) {
			case 'title':
				return entry.book.title.toLowerCase();
			case 'author':
				return entry.book.author?.toLowerCase() ?? '';
			case 'status':
				return STATUS_TABLE_LABELS[entry.userBook.status] ?? entry.userBook.status;
			case 'rating':
				return entry.userBook.rating ?? -1;
			case 'format':
				return entry.userBook.format ?? '';
		}
	}

	let sortedBooks = $derived(
		[...data.books].sort((a, b) => {
			const av = sortValue(a, sortKey);
			const bv = sortValue(b, sortKey);
			const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
			return sortDir === 'asc' ? cmp : -cmp;
		})
	);
</script>

<svelte:head>
	<title>My Library — Ajar Books</title>
</svelte:head>

<div class="profile-library">
	<div class="search-bar">
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
				placeholder="Search your library by title or author…"
				value={data.filters.q}
				oninput={(e) => handleSearchInput(e.currentTarget.value)}
			/>
		</div>
	</div>

	<div class="profile-library__tabs">
		{#each STATUS_TABS as tab (tab.value)}
			<button
				type="button"
				class="status-control__pill"
				class:status-control__pill--active={data.filters.status === tab.value}
				onclick={() => updateFilter('status', tab.value)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<div class="search-toolbar">
		<div class="profile-library__filters">
			<Dropdown
				value={data.filters.genre}
				options={[
					{ value: '', label: 'All genres' },
					...data.filterOptions.genres.map((genre) => ({ value: genre, label: genre }))
				]}
				ariaLabel="Filter by genre"
				onChange={(v) => updateFilter('genre', v)}
			/>
			<Dropdown
				value={data.filters.mood}
				options={[
					{ value: '', label: 'All moods' },
					...data.filterOptions.moods.map((mood) => ({ value: mood, label: mood }))
				]}
				ariaLabel="Filter by mood"
				onChange={(v) => updateFilter('mood', v)}
			/>
			<Dropdown
				value={data.filters.format}
				options={[
					{ value: '', label: 'All formats' },
					{ value: 'physical', label: 'Physical' },
					{ value: 'ebook', label: 'Ebook' },
					{ value: 'audiobook', label: 'Audiobook' }
				]}
				ariaLabel="Filter by format"
				onChange={(v) => updateFilter('format', v)}
			/>
		</div>
		<ViewToggle showTable />
	</div>

	{#if data.totalBookCount === 0}
		<p class="dashboard__empty">
			Nothing here yet — books you add and set a status for will show up here.
		</p>
	{:else if data.sections.length === 0}
		<p class="dashboard__empty">No books match those filters.</p>
	{:else if viewModeState.current === 'table'}
		<div class="profile-table-wrap">
			<table class="profile-table">
				<thead>
					<tr>
						<th></th>
						<th>
							<button
								type="button"
								class="profile-table__sort"
								onclick={() => toggleSort('title')}
							>
								Title{#if sortKey === 'title'}<span class="profile-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th>
							<button
								type="button"
								class="profile-table__sort"
								onclick={() => toggleSort('author')}
							>
								Author{#if sortKey === 'author'}<span class="profile-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th>
							<button
								type="button"
								class="profile-table__sort"
								onclick={() => toggleSort('status')}
							>
								Status{#if sortKey === 'status'}<span class="profile-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th>Genre</th>
						<th>Mood</th>
						<th>
							<button
								type="button"
								class="profile-table__sort"
								onclick={() => toggleSort('format')}
							>
								Format{#if sortKey === 'format'}<span class="profile-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
						<th>
							<button
								type="button"
								class="profile-table__sort"
								onclick={() => toggleSort('rating')}
							>
								Rating{#if sortKey === 'rating'}<span class="profile-table__sort-arrow"
										>{sortDir === 'asc' ? '▲' : '▼'}</span
									>{/if}
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedBooks as entry (entry.userBook.id)}
						<tr>
							<td class="profile-table__cover-cell">
								{#if entry.book.coverUrl}
									<img class="profile-table__cover" src={entry.book.coverUrl} alt="" />
								{:else}
									<div class="profile-table__cover profile-table__cover--placeholder"></div>
								{/if}
							</td>
							<td>
								<a href={resolve('/(app)/books/[id]', { id: entry.book.id })}
									>{entry.book.title}</a
								>
								{#if entry.userBook.isFavorite}<span
										class="profile-table__favorite"
										title="Favorite">★</span
									>{/if}
							</td>
							<td>{entry.book.author ?? '—'}</td>
							<td>{STATUS_TABLE_LABELS[entry.userBook.status] ?? entry.userBook.status}</td>
							<td>{entry.tags.genre.join(', ') || '—'}</td>
							<td>{entry.tags.mood.join(', ') || '—'}</td>
							<td>{entry.userBook.format ?? '—'}</td>
							<td>{entry.userBook.rating ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="profile-library__sections">
			{#each data.sections as section (section.status)}
				<section
					class="profile-library__section"
					class:profile-library__section--favorites={section.status === 'favorites'}
					class:profile-library__section--dnf={section.status === 'dnf'}
				>
					<h3 class="profile-library__section-heading">
						{#if section.status === 'favorites'}★{/if}
						{section.label}
					</h3>
					<div
						class="profile-library__row"
						class:profile-library__row--cards={viewModeState.current === 'cards'}
					>
						{#each section.books as entry (entry.userBook.id)}
							<a class="search-result" href={resolve('/(app)/books/[id]', { id: entry.book.id })}>
								<div class="search-result__cover-wrap">
									{#if entry.book.coverUrl}
										<img class="search-result__cover" src={entry.book.coverUrl} alt="" />
									{:else}
										<div class="search-result__cover search-result__cover--placeholder"></div>
									{/if}
									{#if entry.userBook.rating}
										<span class="search-result__rating-badge">★ {entry.userBook.rating}</span>
									{/if}
								</div>
								<div class="search-result__info">
									<p class="search-result__title">{entry.book.title}</p>
									{#if entry.book.author}
										<p class="search-result__author">{entry.book.author}</p>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
