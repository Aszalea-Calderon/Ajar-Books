<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { interactivity } from '@threlte/extras';
	import Shelf from './Shelf.svelte';
	import Book3D from './Book3D.svelte';
	import {
		columnsFor,
		positionFor,
		rowCountFor,
		visibleRowRange,
		visibleIndices,
		COVER_COLUMN_PITCH,
		SPINE_COLUMN_PITCH,
		ROW_PITCH,
		BOOK_HEIGHT,
		type ShelfOrientation
	} from '$lib/client/shelf/layout';
	import type { ShelfBook } from '$lib/client/shelf/bookTextures';

	type Book = ShelfBook & { coverUrl: string | null; isbn: string | null };

	let {
		books,
		scrollY,
		orientation,
		onOpen,
		columnsOverride,
		showStatusBadge = true
	}: {
		books: Book[];
		scrollY: number;
		orientation: ShelfOrientation;
		onOpen: (book: Book) => void;
		// Lets a caller (the Insights drill-down panel) offer a compact/expanded
		// density toggle without this component's default width-based column
		// count, which is tuned for the full-page Profile shelf. Undefined
		// preserves the original width-derived behavior exactly.
		columnsOverride?: number;
		showStatusBadge?: boolean;
	} = $props();

	interactivity();
	const { size, invalidate } = useThrelte();

	const ROW_PX = 300; // page-scroll pixels per shelf row
	const FOV_DEG = 32;
	const CAMERA_MARGIN = 1.15;

	let columnPitch = $derived(orientation === 'spine' ? SPINE_COLUMN_PITCH : COVER_COLUMN_PITCH);
	let columns = $derived(columnsOverride ?? columnsFor(size.current.width, orientation));
	let totalRows = $derived(rowCountFor(books.length, columns));
	let targetRowOffset = $derived(scrollY / ROW_PX);

	let currentRowOffset = $state(0);
	let settling = $derived(Math.abs(targetRowOffset - currentRowOffset) > 0.0005);

	useTask(
		(delta) => {
			currentRowOffset += (targetRowOffset - currentRowOffset) * (1 - Math.exp(-12 * delta));
			invalidate();
		},
		{ running: () => settling, autoInvalidate: false }
	);

	let cameraZ = $derived.by(() => {
		const vFovRad = (FOV_DEG * Math.PI) / 180;
		const aspect = size.current.width / (size.current.height || size.current.width || 1) || 1;
		const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);
		const worldWidthNeeded = columns * columnPitch * CAMERA_MARGIN;
		return worldWidthNeeded / 2 / Math.tan(hFovRad / 2);
	});

	let viewportRows = $derived.by(() => {
		const vFovRad = (FOV_DEG * Math.PI) / 180;
		const worldHeightVisible = 2 * cameraZ * Math.tan(vFovRad / 2);
		return worldHeightVisible / ROW_PITCH;
	});

	// Derived from the *target* offset (not the eased current one) so
	// meshes exist a frame before they're scrolled into view.
	let rowRange = $derived(visibleRowRange(targetRowOffset, viewportRows, totalRows, 1));
	let indices = $derived(visibleIndices(rowRange, columns, books.length));
	let visibleRows = $derived(
		Array.from({ length: Math.max(0, rowRange.endRow - rowRange.startRow + 1) }, (_, i) => rowRange.startRow + i)
	);
	let shelfWidth = $derived(columns * columnPitch + 0.08);

	// Without this, the current scroll row sits at vertical screen-center,
	// which wastes the whole upper half of the frame when there's nothing
	// above row 0 to fill it (the common case: top of the shelf). Shifting
	// the anchor up by roughly half the viewport, minus a little headroom,
	// puts the current row near the top of frame instead.
	const TOP_PAD_ROWS = 0.6;
	let verticalAnchor = $derived((viewportRows / 2 - TOP_PAD_ROWS) * ROW_PITCH);
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, cameraZ]} fov={FOV_DEG} />
<T.AmbientLight intensity={0.6} />
<T.DirectionalLight position={[2.5, 4, 5]} intensity={1.5} />
<T.HemisphereLight intensity={0.3} />

<T.Group position.y={currentRowOffset * ROW_PITCH + verticalAnchor}>
	{#each visibleRows as row (row)}
		<Shelf y={-row * ROW_PITCH - BOOK_HEIGHT / 2 - 0.02} width={shelfWidth} />
	{/each}
	{#each indices as index (books[index]?.id ?? index)}
		{@const book = books[index]}
		{@const pos = positionFor(index, columns, book.id, orientation)}
		<Book3D
			{book}
			x={pos.x}
			y={pos.y}
			z={pos.z}
			tilt={pos.tilt}
			spineOut={orientation === 'spine'}
			{showStatusBadge}
			{onOpen}
		/>
	{/each}
</T.Group>
