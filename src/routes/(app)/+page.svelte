<script lang="ts">
	import { resolve } from '$app/paths';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let hero = $derived(data.currentlyReading[0]);
	let rest = $derived(data.currentlyReading.slice(1));
</script>

<svelte:head>
	<title>Ajar Books</title>
</svelte:head>

<div class="dashboard">
	<section class="dashboard__panel dashboard__panel--hero">
		<h2>Currently Reading</h2>
		{#if !hero}
			<p class="dashboard__empty">Nothing in progress yet.</p>
			<a class="dashboard__cta" href={resolve('/search')}>Add a Book</a>
		{:else}
			<a class="currently-reading" href={resolve('/(app)/books/[id]', { id: hero.book.id })}>
				{#if hero.book.coverUrl}
					<img class="currently-reading__cover" src={hero.book.coverUrl} alt="" />
				{:else}
					<div class="currently-reading__cover currently-reading__cover--placeholder"></div>
				{/if}
				<div class="currently-reading__info">
					<p class="currently-reading__title">{hero.book.title}</p>
					{#if hero.book.author}
						<p class="currently-reading__author">{hero.book.author}</p>
					{/if}
					<ProgressBar
						current={hero.userBook.format === 'audiobook' ? hero.totals.minutes : hero.totals.pages}
						total={hero.userBook.format === 'audiobook'
							? hero.userBook.totalMinutes
							: hero.userBook.totalPages}
						unit={hero.userBook.format === 'audiobook' ? 'minutes' : 'pages'}
					/>
				</div>
			</a>

			{#if rest.length > 0}
				<div class="currently-reading-chips">
					{#each rest as row (row.userBook.id)}
						<a
							class="currently-reading-chip"
							href={resolve('/(app)/books/[id]', { id: row.book.id })}
						>
							{row.book.title}
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	</section>

	<section class="dashboard__panel dashboard__panel--streak">
		<h2>Reading Streak</h2>
		<p class="dashboard__empty">
			Your streak calendar will show up here once you log some reading.
		</p>
	</section>

	<section class="dashboard__panel dashboard__panel--goal">
		<h2>Reading Goal</h2>
		<p class="dashboard__empty">Set a reading goal to track your progress here.</p>
	</section>
</div>
