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
</script>

<svelte:head>
	<title>My Library — Ajar Books</title>
</svelte:head>

<div class="profile-library">
	<div class="search-bar">
		<input
			class="search-bar__input"
			type="search"
			placeholder="Search your library by title or author…"
			value={data.filters.q}
			oninput={(e) => handleSearchInput(e.currentTarget.value)}
		/>
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
		<ViewToggle />
	</div>

	{#if data.totalBookCount === 0}
		<p class="dashboard__empty">
			Nothing here yet — books you add and set a status for will show up here.
		</p>
	{:else if data.sections.length === 0}
		<p class="dashboard__empty">No books match those filters.</p>
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
