<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { columnsFor, rowCountFor, type ShelfOrientation } from '$lib/client/shelf/layout';
	import type { ShelfBook } from '$lib/client/shelf/bookTextures';

	type Book = ShelfBook & { coverUrl: string | null; isbn: string | null };
	type Density = 'compact' | 'expanded';

	// Orientation and density are owned by the parent panel now — both are
	// offered from the same "eye" view-mode dropdown (via ViewButton's
	// `extra` snippet) rather than a separate control row above the shelf.
	let { books, orientation, density }: { books: Book[]; orientation: ShelfOrientation; density: Density } =
		$props();

	// Matches ShelfSceneContent's own (component-local, not exported) row-
	// pixel convention — this feeds its scrollY prop directly, so a wheel
	// delta needs to land in the same units that component's internal
	// `/ ROW_PX` conversion expects.
	const ROW_PX = 300;

	let containerEl = $state<HTMLDivElement>();
	let canvasWrapEl = $state<HTMLDivElement>();
	let containerWidth = $state(0);
	let webglOk = $state(true);
	let Scene = $state<typeof import('$lib/components/shelf/ShelfScene.svelte').default | null>(null);
	let scrollY = $state(0);

	onMount(async () => {
		const probe = document.createElement('canvas');
		webglOk = !!(probe.getContext('webgl2') || probe.getContext('webgl'));
		if (!webglOk) return;
		Scene = (await import('$lib/components/shelf/ShelfScene.svelte')).default;
	});

	const DENSITY_COLUMN_DELTA = { compact: 1, expanded: -1 } as const;
	// Bypasses columnsFor's own floor (3 for covers, 6 for spines) — that
	// floor is right for the full-page Profile shelf, but "expanded" here
	// specifically wants to go below it.
	let columns = $derived(
		Math.max(
			orientation === 'spine' ? 3 : 2,
			columnsFor(containerWidth || 400, orientation) + DENSITY_COLUMN_DELTA[density]
		)
	);
	let rowCount = $derived(rowCountFor(books.length, columns));
	let maxScrollY = $derived(Math.max(0, (rowCount - 1) * ROW_PX));

	// Scoped to this panel, not the page — a real scrollbar here would fight
	// with the page's own scroll, and this is a small fixed-size viewport
	// showing a handful of books, not a full page of shelf content the way
	// Profile's ShelfView is. Attached manually with { passive: false } —
	// Svelte's onwheel attribute binding doesn't reliably let
	// preventDefault() stop the page from *also* scrolling otherwise.
	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		scrollY = Math.min(maxScrollY, Math.max(0, scrollY + event.deltaY));
	}

	$effect(() => {
		const el = canvasWrapEl;
		if (!el) return;
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	});

	function handleOpen(book: Book) {
		goto(resolve('/(app)/books/[id]', { id: book.id }));
	}
</script>

<div class="drill-down-shelf" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if books.length === 0}
		<p class="settings-hint">No books found.</p>
	{:else if !webglOk}
		<p class="dashboard__empty">Your browser doesn't support 3D — try Profile's other views instead.</p>
	{:else if Scene}
		{#if rowCount > 1}
			<p class="settings-hint drill-down-shelf__hint">Scroll to see more</p>
		{/if}
		<div class="drill-down-shelf__canvas" bind:this={canvasWrapEl}>
			<Scene {books} {scrollY} {orientation} columnsOverride={columns} showStatusBadge={false} onOpen={handleOpen} />
		</div>
	{:else}
		<p class="dashboard__empty">Building your shelf…</p>
	{/if}
</div>
