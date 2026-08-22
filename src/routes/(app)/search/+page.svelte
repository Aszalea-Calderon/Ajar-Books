<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/state';
	import { resolve } from '$app/paths';
	import { searchViewMode } from '$lib/client/viewMode.svelte';
	import Dropdown from '$lib/components/Dropdown.svelte';
	import FilterButton from '$lib/components/FilterButton.svelte';
	import ViewButton from '$lib/components/ViewButton.svelte';
	import { coverSrc } from '$lib/coverPlaceholder';
	import { STATUS_LABELS } from '$lib/bookStatus';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let submittingKey = $state<string | null>(null);
	let hideInLibrary = $state(false);
	let genreFilter = $state('');
	let moodFilter = $state('');
	let formatFilter = $state('');
	let statusFilter = $state('');

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
		genreFilter = '';
		moodFilter = '';
		formatFilter = '';
		statusFilter = '';
	});

	let isSearching = $derived(!!navigating.to && navigating.to.url.pathname === '/search');

	// Genre is already present on every fetched result (Open Library's search
	// endpoint returns it inline — see searchOpenLibrary), so this narrows the
	// already-loaded results client-side rather than needing another round
	// trip, the same way hideInLibrary does. Options are whatever genres are
	// actually present in the current result set, not a fixed/global list.
	let availableGenres = $derived(
		[...new Set(allResults.flatMap((r) => r.genres))].sort((a, b) => a.localeCompare(b))
	);

	// Mood/Format/Status only ever have real values for results that match an
	// existing library entry (see attachLibraryIds) — a result that isn't in
	// the library, or is but never had a status chosen, simply won't match
	// any specific filter value here, same as it not having that data yet.
	let visibleResults = $derived(
		allResults
			.filter((r) => !hideInLibrary || !r.libraryBookId)
			.filter((r) => !genreFilter || r.genres.includes(genreFilter))
			.filter((r) => !moodFilter || r.moods.includes(moodFilter))
			.filter((r) => !formatFilter || r.format === formatFilter)
			.filter((r) => !statusFilter || r.status === statusFilter)
	);

	function resultKey(result: { openLibraryId: string | null; isbn: string | null; title: string }) {
		return result.openLibraryId ?? result.isbn ?? result.title;
	}

	// Applied on a successful bookmark toggle instead of calling SvelteKit's
	// default `update()` — that would invalidateAll() and re-run this page's
	// load(), which hits Open Library/Google Books, just to reflect a status
	// flip that's already fully known client-side.
	function patchResult(key: string, patch: Partial<(typeof allResults)[number]>) {
		const idx = allResults.findIndex((r) => resultKey(r) === key);
		if (idx !== -1) allResults[idx] = { ...allResults[idx], ...patch };
	}

	type SortKey = 'title' | 'author' | 'publicationYear' | 'pageCount';
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

	function sortValue(result: (typeof visibleResults)[number], key: SortKey): string | number {
		switch (key) {
			case 'title':
				return result.title.toLowerCase();
			case 'author':
				return result.author?.toLowerCase() ?? '';
			case 'publicationYear':
				return result.publicationYear ?? -1;
			case 'pageCount':
				return result.pageCount ?? -1;
		}
	}

	let sortedResults = $derived(
		[...visibleResults].sort((a, b) => {
			const av = sortValue(a, sortKey);
			const bv = sortValue(b, sortKey);
			const cmp =
				typeof av === 'number' && typeof bv === 'number'
					? av - bv
					: String(av).localeCompare(String(bv));
			return sortDir === 'asc' ? cmp : -cmp;
		})
	);

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
		<FilterButton
			activeCount={(hideInLibrary ? 1 : 0) +
				(genreFilter ? 1 : 0) +
				(moodFilter ? 1 : 0) +
				(formatFilter ? 1 : 0) +
				(statusFilter ? 1 : 0)}
		>
			{#if hideInLibrary || genreFilter || moodFilter || formatFilter || statusFilter}
				<button
					type="button"
					class="filter-button__reset"
					onclick={() => {
						hideInLibrary = false;
						genreFilter = '';
						moodFilter = '';
						formatFilter = '';
						statusFilter = '';
					}}
				>
					Reset filters
				</button>
			{/if}
			<div class="filter-button__group">
				<span class="filter-button__group-label">Library</span>
				<label class="search-toolbar__filter">
					<input type="checkbox" bind:checked={hideInLibrary} />
					Already in library
				</label>
			</div>
			<div class="filter-button__group">
				<span class="filter-button__group-label">Genre</span>
				<Dropdown
					value={genreFilter}
					options={[
						{ value: '', label: 'All genres' },
						...availableGenres.map((genre) => ({ value: genre, label: genre }))
					]}
					ariaLabel="Filter by genre"
					onChange={(v) => (genreFilter = v)}
				/>
			</div>
			<div class="filter-button__group">
				<span class="filter-button__group-label">Mood</span>
				<Dropdown
					value={moodFilter}
					options={[
						{ value: '', label: 'All moods' },
						...data.filterOptions.moods.map((mood) => ({ value: mood, label: mood }))
					]}
					ariaLabel="Filter by mood"
					onChange={(v) => (moodFilter = v)}
				/>
			</div>
			<div class="filter-button__group">
				<span class="filter-button__group-label">Format</span>
				<Dropdown
					value={formatFilter}
					options={[
						{ value: '', label: 'All formats' },
						{ value: 'physical', label: 'Physical' },
						{ value: 'ebook', label: 'Ebook' },
						{ value: 'audiobook', label: 'Audiobook' }
					]}
					ariaLabel="Filter by format"
					onChange={(v) => (formatFilter = v)}
				/>
			</div>
			<div class="filter-button__group">
				<span class="filter-button__group-label">Status</span>
				<Dropdown
					value={statusFilter}
					options={[
						{ value: '', label: 'All statuses' },
						{ value: 'reading', label: STATUS_LABELS.reading },
						{ value: 'want_to_read', label: STATUS_LABELS.want_to_read },
						{ value: 'finished', label: STATUS_LABELS.finished },
						{ value: 'dnf', label: STATUS_LABELS.dnf }
					]}
					ariaLabel="Filter by status"
					onChange={(v) => (statusFilter = v)}
				/>
			</div>
		</FilterButton>
		<ViewButton mode={searchViewMode.state.current} onSelect={searchViewMode.set} showTable />
	</form>

	{#if data.query}
		{#if data.searchFailed}
			<p class="dashboard__empty">
				Search is temporarily unavailable — Open Library or Google Books didn't respond in time. Try
				again in a moment.
			</p>
		{:else if allResults.length === 0 && !isSearching}
			<p class="dashboard__empty">No results for "{data.query}".</p>
		{:else}
			{#if searchViewMode.state.current === 'table'}
				<div class="data-table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th></th>
								<th>
									<button
										type="button"
										class="data-table__sort"
										onclick={() => toggleSort('title')}
									>
										Title{#if sortKey === 'title'}<span class="data-table__sort-arrow"
												>{sortDir === 'asc' ? '▲' : '▼'}</span
											>{/if}
									</button>
								</th>
								<th>
									<button
										type="button"
										class="data-table__sort"
										onclick={() => toggleSort('author')}
									>
										Author{#if sortKey === 'author'}<span class="data-table__sort-arrow"
												>{sortDir === 'asc' ? '▲' : '▼'}</span
											>{/if}
									</button>
								</th>
								<th>Genre</th>
								<th>
									<button
										type="button"
										class="data-table__sort"
										onclick={() => toggleSort('publicationYear')}
									>
										Published{#if sortKey === 'publicationYear'}<span class="data-table__sort-arrow"
												>{sortDir === 'asc' ? '▲' : '▼'}</span
											>{/if}
									</button>
								</th>
								<th>
									<button
										type="button"
										class="data-table__sort"
										onclick={() => toggleSort('pageCount')}
									>
										Pages{#if sortKey === 'pageCount'}<span class="data-table__sort-arrow"
												>{sortDir === 'asc' ? '▲' : '▼'}</span
											>{/if}
									</button>
								</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each sortedResults as result (resultKey(result))}
								<tr>
									<td class="data-table__cover-cell">
										<img class="data-table__cover" src={coverSrc(result.coverUrl, resultKey(result), result.title)} alt="" />
									</td>
									<td>
										{#if result.libraryBookId}
											<a
												class="data-table__link"
												href={resolve('/(app)/books/[id]', { id: result.libraryBookId })}
											>
												{result.title}
											</a>
										{:else}
											<form
												method="POST"
												action="?/add"
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
												<input
													type="hidden"
													name="openLibraryId"
													value={result.openLibraryId ?? ''}
												/>
												<input type="hidden" name="isbn" value={result.isbn ?? ''} />
												<input type="hidden" name="description" value={result.description ?? ''} />
												<input type="hidden" name="pageCount" value={result.pageCount ?? ''} />
												<input
													type="hidden"
													name="publicationYear"
													value={result.publicationYear ?? ''}
												/>
												{#each result.genres as genre (genre)}
													<input type="hidden" name="genres" value={genre} />
												{/each}
												<button
													type="submit"
													class="data-table__link data-table__link--button"
													disabled={submittingKey === resultKey(result)}
												>
													{result.title}
												</button>
											</form>
										{/if}
									</td>
									<td>{result.author ?? '—'}</td>
									<td>{result.genres.join(', ') || '—'}</td>
									<td>{result.publicationYear ?? '—'}</td>
									<td>{result.pageCount ?? '—'}</td>
									<td>
										<form
											method="POST"
											action={result.isWantToRead ? '?/removeFromWantToRead' : '?/addToWantToRead'}
											use:enhance={() => {
												const key = resultKey(result);
												const wasWantToRead = result.isWantToRead;
												submittingKey = key;
												return async ({ result: actionResult, update }) => {
													if (actionResult.type === 'success') {
														if (wasWantToRead) {
															patchResult(key, { isWantToRead: false });
														} else {
															const bookId =
																(actionResult.data?.bookId as string | undefined) ?? null;
															patchResult(key, {
																isWantToRead: true,
																libraryBookId: bookId ?? result.libraryBookId
															});
														}
													} else {
														await update();
													}
													submittingKey = null;
												};
											}}
										>
											{#if result.libraryBookId}
												<input type="hidden" name="bookId" value={result.libraryBookId} />
											{:else}
												<input type="hidden" name="title" value={result.title} />
												<input type="hidden" name="author" value={result.author ?? ''} />
												<input type="hidden" name="coverUrl" value={result.coverUrl ?? ''} />
												<input
													type="hidden"
													name="openLibraryId"
													value={result.openLibraryId ?? ''}
												/>
												<input type="hidden" name="isbn" value={result.isbn ?? ''} />
												<input type="hidden" name="description" value={result.description ?? ''} />
												<input type="hidden" name="pageCount" value={result.pageCount ?? ''} />
												<input
													type="hidden"
													name="publicationYear"
													value={result.publicationYear ?? ''}
												/>
												{#each result.genres as genre (genre)}
													<input type="hidden" name="genres" value={genre} />
												{/each}
											{/if}
											<button
												type="submit"
												class="data-table__bookmark"
												class:data-table__bookmark--active={result.isWantToRead}
												aria-label={result.isWantToRead
													? `Remove ${result.title} from Want to Read`
													: `Add ${result.title} to Want to Read`}
												title={result.isWantToRead
													? 'Remove from Want to Read'
													: 'Add to Want to Read'}
												disabled={submittingKey === resultKey(result)}
											>
												<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
													<path
														fill="currentColor"
														d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z"
													/>
												</svg>
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div
					class="search-results"
					class:search-results--cards={searchViewMode.state.current === 'cards'}
				>
					{#each visibleResults as result (resultKey(result))}
						{#if result.libraryBookId}
							<div class="search-result">
								<a
									class="search-result__preview"
									href={resolve('/(app)/books/[id]', { id: result.libraryBookId })}
								>
									<img class="search-result__cover" src={coverSrc(result.coverUrl, resultKey(result), result.title)} alt="" />
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
											const key = resultKey(result);
											submittingKey = key;
											return async ({ result: actionResult, update }) => {
												if (actionResult.type === 'success') {
													patchResult(key, { isWantToRead: false });
												} else {
													await update();
												}
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
											const key = resultKey(result);
											submittingKey = key;
											return async ({ result: actionResult, update }) => {
												if (actionResult.type === 'success') {
													patchResult(key, { isWantToRead: true });
												} else {
													await update();
												}
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
										<input
											type="hidden"
											name="publicationYear"
											value={result.publicationYear ?? ''}
										/>
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
									const key = resultKey(result);
									submittingKey = key;
									return async ({ action, result: actionResult, update }) => {
										if (action.search === '?/addToWantToRead' && actionResult.type === 'success') {
											const bookId = (actionResult.data?.bookId as string | undefined) ?? null;
											patchResult(key, { isWantToRead: true, libraryBookId: bookId });
										} else {
											// The default `?/add` action redirects on success — let the
											// normal enhance flow (and any failure) handle it as before.
											await update();
										}
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
									<img class="search-result__cover" src={coverSrc(result.coverUrl, resultKey(result), result.title)} alt="" />
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
										<path
											fill="currentColor"
											d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Z"
										/>
									</svg>
								</button>
								{#if submittingKey === resultKey(result)}
									<span class="search-result__label"><span class="spinner"></span></span>
								{/if}
							</form>
						{/if}
					{/each}
				</div>
			{/if}

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
		{/if}
	{:else if data.wantToReadByGenre.length > 0}
		<div class="search-recommendations">
			<h3 class="search-recommendations__heading">From your Want to Read list</h3>
			{#each data.wantToReadByGenre as group (group.genre)}
				<div class="search-recommendations__group">
					<h4 class="search-recommendations__genre">{group.genre}</h4>
					<div class="search-results" class:search-results--cards={searchViewMode.state.current === 'cards'}>
						{#each group.books as book (book.id)}
							<a class="search-result" href={resolve('/(app)/books/[id]', { id: book.id })}>
								<img class="search-result__cover" src={coverSrc(book.coverUrl, book.id, book.title)} alt="" />
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
					<div class="search-results" class:search-results--cards={searchViewMode.state.current === 'cards'}>
						{#each group.books as book (book.title)}
							<a
								class="search-result"
								href={resolve(`/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`)}
							>
								<img class="search-result__cover" src={coverSrc(undefined, book.title, book.title)} alt="" />
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
