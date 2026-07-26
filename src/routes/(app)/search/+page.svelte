<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let submittingKey = $state<string | null>(null);

	let isSearching = $derived(!!navigating.to && navigating.to.url.pathname === '/search');

	function resultKey(result: { openLibraryId: string | null; isbn: string | null; title: string }) {
		return result.openLibraryId ?? result.isbn ?? result.title;
	}

	function handleSearchSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
		// A plain <form method="GET"> triggers a native full-page reload, which
		// SvelteKit's client-side router (and its `navigating` state) never
		// sees — driving it through goto() instead is what makes the loading
		// spinner below actually have something to react to.
		event.preventDefault();
		const params = new URLSearchParams(new FormData(event.currentTarget) as never);
		goto(resolve(`/search?${params.toString()}`));
	}
</script>

<svelte:head>
	<title>Search — Ajar Books</title>
</svelte:head>

<div class="search-page">
	<form class="search-bar" onsubmit={handleSearchSubmit}>
		<input
			class="search-bar__input"
			type="search"
			name="q"
			placeholder="Search by title or author…"
			value={data.query}
		/>
		<button class="search-bar__submit" type="submit" disabled={isSearching}>
			{#if isSearching}
				<span class="spinner"></span> Searching…
			{:else}
				Search
			{/if}
		</button>
	</form>

	{#if data.query && data.results.length === 0 && !isSearching}
		<p class="dashboard__empty">No results for "{data.query}".</p>
	{/if}

	<div class="search-results">
		{#each data.results as result (resultKey(result))}
			{#if result.libraryBookId}
				<a class="search-result" href={resolve('/(app)/books/[id]', { id: result.libraryBookId })}>
					{#if result.coverUrl}
						<img class="search-result__cover" src={result.coverUrl} alt="" />
					{:else}
						<div class="search-result__cover search-result__cover--placeholder"></div>
					{/if}
					<div class="search-result__info">
						<p class="search-result__title">{result.title}</p>
						{#if result.author}
							<p class="search-result__author">{result.author}</p>
						{/if}
					</div>
					<span class="search-result__label">View in library</span>
				</a>
			{:else}
				<form
					method="POST"
					action="?/add"
					class="search-result"
					use:enhance={() => {
						submittingKey = resultKey(result);
						return async ({ update }) => {
							await update();
							submittingKey = null;
						};
					}}
				>
					<input type="hidden" name="title" value={result.title} />
					<input type="hidden" name="author" value={result.author ?? ''} />
					<input type="hidden" name="coverUrl" value={result.coverUrl ?? ''} />
					<input type="hidden" name="openLibraryId" value={result.openLibraryId ?? ''} />
					<input type="hidden" name="isbn" value={result.isbn ?? ''} />
					<input type="hidden" name="description" value={result.description ?? ''} />
					<input type="hidden" name="pageCount" value={result.pageCount ?? ''} />
					<button
						type="submit"
						class="search-result__preview"
						disabled={submittingKey === resultKey(result)}
					>
						{#if result.coverUrl}
							<img class="search-result__cover" src={result.coverUrl} alt="" />
						{:else}
							<div class="search-result__cover search-result__cover--placeholder"></div>
						{/if}
						<div class="search-result__info">
							<p class="search-result__title">{result.title}</p>
							{#if result.author}
								<p class="search-result__author">{result.author}</p>
							{/if}
						</div>
					</button>
					<span class="search-result__label">
						{#if submittingKey === resultKey(result)}
							<span class="spinner"></span> Adding…
						{:else}
							Add to Library
						{/if}
					</span>
				</form>
			{/if}
		{/each}
	</div>
</div>
