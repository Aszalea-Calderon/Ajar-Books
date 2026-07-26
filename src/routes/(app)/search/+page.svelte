<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Search — Ajar Books</title>
</svelte:head>

<div class="search-page">
	<form class="search-bar" method="GET">
		<input
			class="search-bar__input"
			type="search"
			name="q"
			placeholder="Search by title or author…"
			value={data.query}
		/>
		<button class="search-bar__submit" type="submit">Search</button>
	</form>

	{#if data.query && data.results.length === 0}
		<p class="dashboard__empty">No results for "{data.query}".</p>
	{/if}

	<div class="search-results">
		{#each data.results as result (result.openLibraryId ?? result.isbn ?? result.title)}
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
				<form method="POST" action="?/add" use:enhance class="search-result">
					<input type="hidden" name="title" value={result.title} />
					<input type="hidden" name="author" value={result.author ?? ''} />
					<input type="hidden" name="coverUrl" value={result.coverUrl ?? ''} />
					<input type="hidden" name="openLibraryId" value={result.openLibraryId ?? ''} />
					<input type="hidden" name="isbn" value={result.isbn ?? ''} />
					<button type="submit" class="search-result__preview">
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
					<span class="search-result__label">Add to Library</span>
				</form>
			{/if}
		{/each}
	</div>
</div>
