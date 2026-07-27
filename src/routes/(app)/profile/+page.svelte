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

	const STATUS_LABELS: Record<string, string> = {
		reading: 'Currently Reading',
		want_to_read: 'Want to Read',
		finished: 'Finished',
		dnf: 'Did Not Finish'
	};

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
		// Changing a filter changes which books belong to each group, so any
		// "Load more" progress from before no longer means the same thing.
		for (const paramKey of [...params.keys()]) {
			if (paramKey.endsWith('Take')) params.delete(paramKey);
		}
		goto(resolve(`/profile?${params.toString()}`), { keepFocus: true, noScroll: true });
	}

	// Must match the server's PAGE_SIZE in +page.server.ts.
	const PAGE_SIZE = 24;

	function loadMore(status: string, take: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		params.set(`${status}Take`, String(take + PAGE_SIZE));
		goto(resolve(`/profile?${params.toString()}`), { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Profile — Ajar Books</title>
</svelte:head>

<div class="profile-library">
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
			<label class="search-toolbar__filter">
				<input
					type="checkbox"
					checked={data.filters.favorites}
					onchange={(e) => updateFilter('favorites', e.currentTarget.checked)}
				/>
				★ Favorites (4+)
			</label>
		</div>
		<ViewToggle />
	</div>

	{#if data.totalBookCount === 0}
		<p class="dashboard__empty">
			Nothing here yet — books you add and set a status for will show up here.
		</p>
	{:else if data.groups.length === 0}
		<p class="dashboard__empty">No books match those filters.</p>
	{:else}
		<div class="profile-library__groups">
			{#each data.groups as group (group.status)}
				<section class="profile-library__group">
					<h3 class="search-recommendations__genre">{STATUS_LABELS[group.status]}</h3>
					<div
						class="search-results"
						class:search-results--cards={viewModeState.current === 'cards'}
					>
						{#each group.books as entry (entry.userBook.id)}
							<a class="search-result" href={resolve('/(app)/books/[id]', { id: entry.book.id })}>
								{#if entry.book.coverUrl}
									<img class="search-result__cover" src={entry.book.coverUrl} alt="" />
								{:else}
									<div class="search-result__cover search-result__cover--placeholder"></div>
								{/if}
								<div class="search-result__info">
									<p class="search-result__title">{entry.book.title}</p>
									{#if entry.book.author}
										<p class="search-result__author">{entry.book.author}</p>
									{/if}
									{#if entry.tags.genre.length > 0}
										<div class="search-result__genres">
											{#each entry.tags.genre as genre (genre)}
												<span class="tag-chip tag-chip--static">{genre}</span>
											{/each}
										</div>
									{/if}
								</div>
								{#if entry.userBook.rating}
									<span class="search-result__label">★ {entry.userBook.rating}</span>
								{/if}
							</a>
						{/each}
					</div>
					{#if group.hasMore}
						<button
							type="button"
							class="profile-library__load-more"
							onclick={() => loadMore(group.status, group.take)}
						>
							Load more ({group.total - group.take} remaining)
						</button>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>
