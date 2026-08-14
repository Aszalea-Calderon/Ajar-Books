<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { columnsFor, rowCountFor, type ShelfOrientation } from '$lib/client/shelf/layout';
	import type { BookStatus } from '$lib/client/shelf/bookTextures';

	type LibraryBook = {
		id: string;
		title: string;
		author: string | null;
		coverUrl: string | null;
		isbn: string | null;
		status: BookStatus;
		rating: number | null;
	};

	let { books }: { books: LibraryBook[] } = $props();

	let scrollY = $state(0);
	let containerEl = $state<HTMLDivElement | undefined>(undefined);
	let containerWidth = $state(0);
	let containerTop = $state(0);
	let webglOk = $state(true);
	let Scene = $state<typeof import('./ShelfScene.svelte').default | null>(null);
	let orientation = $state<ShelfOrientation>('cover');

	onMount(async () => {
		containerTop = containerEl?.offsetTop ?? 0;

		const probe = document.createElement('canvas');
		webglOk = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
		if (!webglOk) return;
		Scene = (await import('./ShelfScene.svelte')).default;
	});

	const ROW_PX = 300; // must match ShelfSceneContent's own ROW_PX

	let columns = $derived(columnsFor(containerWidth || 1200, orientation));
	let rowCount = $derived(rowCountFor(books.length, columns));
	// Enough scroll distance to reach the last row, plus a viewport's worth
	// of slack so the sticky canvas has somewhere to release from.
	let spacerHeight = $derived(Math.max(0, rowCount - 1) * ROW_PX + 900);

	// scrollY is the whole page's scroll position, not just this
	// component's — subtract how far down the page this container starts
	// so the shelf's own scroll mapping starts at 0, not wherever the page
	// happened to be when it came into view.
	let effectiveScrollY = $derived(Math.max(0, scrollY - containerTop));

	function handleOpen(book: LibraryBook) {
		goto(resolve('/(app)/books/[id]', { id: book.id }));
	}
</script>

<svelte:window bind:scrollY />

<div
	class="shelf-view"
	bind:this={containerEl}
	bind:clientWidth={containerWidth}
	style="height: {spacerHeight}px"
>
	<div class="shelf-view__sticky">
		{#if books.length === 0}
			<p class="dashboard__empty">Nothing here yet — books you add and set a status for will show up here.</p>
		{:else if !webglOk}
			<p class="dashboard__empty">Your browser doesn't support 3D — try Cards, List, or Table view instead.</p>
		{:else if Scene}
			<div class="shelf-view__orientation" role="radiogroup" aria-label="Shelf orientation">
				<button
					type="button"
					class="shelf-view__orientation-btn"
					class:shelf-view__orientation-btn--active={orientation === 'cover'}
					aria-pressed={orientation === 'cover'}
					onclick={() => (orientation = 'cover')}
				>
					Covers
				</button>
				<button
					type="button"
					class="shelf-view__orientation-btn"
					class:shelf-view__orientation-btn--active={orientation === 'spine'}
					aria-pressed={orientation === 'spine'}
					onclick={() => (orientation = 'spine')}
				>
					Spines
				</button>
			</div>
			<Scene {books} scrollY={effectiveScrollY} {orientation} onOpen={handleOpen} />
		{:else}
			<p class="dashboard__empty">Building your shelf…</p>
		{/if}
	</div>
</div>

{#if books.length > 0}
	<ul class="sr-only" aria-label="All books on the shelf">
		{#each books as book (book.id)}
			<li><a href={resolve('/(app)/books/[id]', { id: book.id })}>{book.title}</a></li>
		{/each}
	</ul>
{/if}
