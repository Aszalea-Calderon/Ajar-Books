<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import { viewModeState } from '$lib/client/viewMode.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let submittingKey = $state<string | null>(null);
	let hideInLibrary = $state(false);

	let isSearching = $derived(!!navigating.to && navigating.to.url.pathname === '/search');

	let visibleResults = $derived(
		hideInLibrary ? data.results.filter((r) => !r.libraryBookId) : data.results
	);

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

	{#if data.query}
		{#if data.results.length === 0 && !isSearching}
			<p class="dashboard__empty">No results for "{data.query}".</p>
		{:else if data.results.length > 0}
			<div class="search-toolbar">
				<label class="search-toolbar__filter">
					<input type="checkbox" bind:checked={hideInLibrary} />
					Hide books already in my library
				</label>
				<ViewToggle />
			</div>
		{/if}

		<div class="search-results" class:search-results--cards={viewModeState.current === 'cards'}>
			{#each visibleResults as result (resultKey(result))}
				{#if result.libraryBookId}
					<a
						class="search-result"
						href={resolve('/(app)/books/[id]', { id: result.libraryBookId })}
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
							{#if result.genres.length > 0}
								<div class="search-result__genres">
									{#each result.genres as genre (genre)}
										<span class="tag-chip tag-chip--static">{genre}</span>
									{/each}
								</div>
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
						<input type="hidden" name="publicationYear" value={result.publicationYear ?? ''} />
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
								{#if result.genres.length > 0}
									<div class="search-result__genres">
										{#each result.genres as genre (genre)}
											<span class="tag-chip tag-chip--static">{genre}</span>
										{/each}
									</div>
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
	{:else if data.wantToReadByGenre.length > 0}
		<div class="search-recommendations">
			<h3 class="search-recommendations__heading">From your Want to Read list</h3>
			{#each data.wantToReadByGenre as group (group.genre)}
				<div class="search-recommendations__group">
					<h4 class="search-recommendations__genre">{group.genre}</h4>
					<div class="search-results search-results--cards">
						{#each group.books as book (book.id)}
							<a class="search-result" href={resolve('/(app)/books/[id]', { id: book.id })}>
								{#if book.coverUrl}
									<img class="search-result__cover" src={book.coverUrl} alt="" />
								{:else}
									<div class="search-result__cover search-result__cover--placeholder"></div>
								{/if}
								<div class="search-result__info">
									<p class="search-result__title">{book.title}</p>
									{#if book.author}
										<p class="search-result__author">{book.author}</p>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
