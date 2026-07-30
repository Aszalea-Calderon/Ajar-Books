<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import { viewModeState } from '$lib/client/viewMode.svelte';
	import FilterButton from '$lib/components/FilterButton.svelte';
	import ViewButton from '$lib/components/ViewButton.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let submittingKey = $state<string | null>(null);
	let hideInLibrary = $state(false);

	// Accumulates across "Load more" clicks — reset below whenever a genuinely
	// new search comes in from the server (data.results changing). The
	// untrack() calls mark the initial reads as intentional (the $effect
	// below is what keeps these in sync with `data`, not this declaration).
	let allResults = $state(untrack(() => data.results));
	let hasMore = $state(untrack(() => data.hasMore));
	let currentPage = $state(1);
	let loadingMore = $state(false);
	let loadMoreFailed = $state(false);

	$effect(() => {
		allResults = data.results;
		hasMore = data.hasMore;
		currentPage = 1;
	});

	let isSearching = $derived(!!navigating.to && navigating.to.url.pathname === '/search');

	let visibleResults = $derived(
		hideInLibrary ? allResults.filter((r) => !r.libraryBookId) : allResults
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
				name="q"
				placeholder="Search by title or author…"
				value={data.query}
			/>
		</div>
		<button class="search-bar__submit" type="submit" disabled={isSearching}>
			{#if isSearching}
				<span class="spinner"></span> Searching…
			{:else}
				Search
			{/if}
		</button>
		<FilterButton activeCount={hideInLibrary ? 1 : 0}>
			<div class="filter-button__group">
				<span class="filter-button__group-label">Library</span>
				<label class="search-toolbar__filter">
					<input type="checkbox" bind:checked={hideInLibrary} />
					Already in library
				</label>
			</div>
		</FilterButton>
		<ViewButton />
	</form>

	{#if data.query}
		{#if data.searchFailed}
			<p class="dashboard__empty">
				Search is temporarily unavailable — Open Library or Google Books didn't respond in time. Try
				again in a moment.
			</p>
		{:else if allResults.length === 0 && !isSearching}
			<p class="dashboard__empty">No results for "{data.query}".</p>
		{/if}

		<div class="search-results" class:search-results--cards={viewModeState.current === 'cards'}>
			{#each visibleResults as result (resultKey(result))}
				{#if result.libraryBookId}
					<div class="search-result">
						<a
							class="search-result__preview"
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
						</a>
						{#if result.isWantToRead}
							<form
								method="POST"
								action="?/removeFromWantToRead"
								use:enhance={() => {
									submittingKey = resultKey(result);
									return async ({ update }) => {
										await update();
										submittingKey = null;
									};
								}}
							>
								<input type="hidden" name="bookId" value={result.libraryBookId} />
								<button
									type="submit"
									class="search-result__bookmark search-result__bookmark--active"
									aria-label="Remove {result.title} from Want to Read"
									title="Remove from Want to Read"
									disabled={submittingKey === resultKey(result)}
								>
									<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
										<path
											fill="currentColor"
											d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z"
										/>
									</svg>
								</button>
							</form>
						{:else}
							<form
								method="POST"
								action="?/addToWantToRead"
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
								{#each result.genres as genre (genre)}
									<input type="hidden" name="genres" value={genre} />
								{/each}
								<button
									type="submit"
									class="search-result__bookmark"
									aria-label="Add {result.title} to Want to Read"
									title="Add to Want to Read"
									disabled={submittingKey === resultKey(result)}
								>
									<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
										<path
											fill="currentColor"
											d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z"
										/>
									</svg>
								</button>
							</form>
						{/if}
					</div>
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
						{#each result.genres as genre (genre)}
							<input type="hidden" name="genres" value={genre} />
						{/each}
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
						<button
							type="submit"
							formaction="?/addToWantToRead"
							class="search-result__bookmark"
							aria-label="Add {result.title} to Want to Read"
							title="Add to Want to Read"
							disabled={submittingKey === resultKey(result)}
						>
							<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
								<path fill="currentColor" d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
							</svg>
						</button>
						{#if submittingKey === resultKey(result)}
							<span class="search-result__label"><span class="spinner"></span></span>
						{/if}
					</form>
				{/if}
			{/each}
		</div>

		{#if hasMore}
			<form
				method="POST"
				action="?/loadMore"
				use:enhance={() => {
					loadingMore = true;
					loadMoreFailed = false;
					return async ({ result }) => {
						loadingMore = false;
						if (result.type === 'success' && result.data) {
							allResults = [...allResults, ...(result.data.results as typeof allResults)];
							hasMore = result.data.hasMore as boolean;
							currentPage += 1;
						} else {
							loadMoreFailed = true;
						}
					};
				}}
			>
				<input type="hidden" name="q" value={data.query} />
				<input type="hidden" name="page" value={currentPage + 1} />
				{#if loadMoreFailed}
					<p class="dashboard__empty">Couldn't load more results. Try again.</p>
				{/if}
				<button type="submit" class="profile-library__load-more" disabled={loadingMore}>
					{#if loadingMore}
						<span class="spinner"></span> Loading…
					{:else}
						Load more
					{/if}
				</button>
			</form>
		{/if}
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
	{:else if data.starterRecommendations.length > 0}
		<div class="search-recommendations">
			<h3 class="search-recommendations__heading">Not sure where to start? A few ideas:</h3>
			{#each data.starterRecommendations as group (group.genre)}
				<div class="search-recommendations__group">
					<h4 class="search-recommendations__genre">{group.genre}</h4>
					<div class="search-results search-results--cards">
						{#each group.books as book (book.title)}
							<a
								class="search-result"
								href={resolve(`/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`)}
							>
								<div class="search-result__cover search-result__cover--placeholder"></div>
								<div class="search-result__info">
									<p class="search-result__title">{book.title}</p>
									<p class="search-result__author">{book.author}</p>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
