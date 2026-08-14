<script lang="ts">
	import { untrack } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import {
		proceduralTexturesFor,
		loadCoverTexture,
		resolveCoverUrl,
		compositeCoverBadge,
		hasShelfBadge,
		type ShelfBook
	} from '$lib/client/shelf/bookTextures';
	import { BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH } from '$lib/client/shelf/layout';

	type Book = ShelfBook & { coverUrl: string | null; isbn: string | null };

	let {
		book,
		x,
		y,
		z,
		tilt,
		spineOut = false,
		onOpen
	}: {
		book: Book;
		x: number;
		y: number;
		z: number;
		tilt: number;
		spineOut?: boolean;
		onOpen: (book: Book) => void;
	} = $props();

	// Each instance is remounted fresh whenever its book identity changes
	// (the parent `{#each}` is keyed by book.id), so it's intentional that
	// everything below reads `book` once at init rather than reactively.
	const initialBook = untrack(() => book);

	// Procedural cover/spine render synchronously so a book never shows a
	// blank box, even mid-scroll before a real cover has had a chance to
	// load — the real photo (if any) swaps in once loadCoverTexture resolves.
	const { cover, spine } = proceduralTexturesFor(initialBook);

	const coverMaterial = new THREE.MeshStandardMaterial({ map: cover, roughness: 0.8 });
	const spineMaterial = new THREE.MeshStandardMaterial({ map: spine, roughness: 0.8 });
	const pagesMaterial = new THREE.MeshStandardMaterial({ color: '#ece7d8', roughness: 0.95 });

	// BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z] — spine on the sides,
	// cover facing forward (+Z), plain "pages" everywhere else.
	const materials = [
		spineMaterial,
		spineMaterial,
		pagesMaterial,
		pagesMaterial,
		coverMaterial,
		pagesMaterial
	];

	const { invalidate } = useThrelte();

	const coverUrl = resolveCoverUrl(initialBook);
	if (coverUrl) {
		loadCoverTexture(coverUrl)
			.then((texture) => {
				// A status/rating badge baked into the procedural cover would be
				// lost outright by assigning the real photo over it — recomposite
				// the photo with the same badges instead. Skipped entirely when
				// there's nothing to draw, so the common case stays exactly as
				// cheap as before this feature existed.
				coverMaterial.map = hasShelfBadge(initialBook)
					? compositeCoverBadge(texture.image as HTMLImageElement, initialBook)
					: texture;
				coverMaterial.needsUpdate = true;
				// The canvas renders on-demand (see ShelfScene.svelte) — without
				// this, a texture swap that lands after the last requested frame
				// (the common case: it's async, the frame that mounted this book
				// already happened) never actually redraws, so the real cover
				// silently never appears despite coverMaterial.map being correct.
				invalidate();
			})
			.catch(() => {
				// Real cover failed to load (404, network, disallowed host, or
				// Open Library's own "no cover on file" placeholder, rejected by
				// the proxy) — the procedural cover already assigned above stays.
			});
	}

	let hovered = $state(false);

	// Same box, just turned 90° — what was the spine (±X) faces the camera
	// instead of the cover (+Z). No geometry/material changes needed.
	let orientationRotation = $derived(spineOut ? -Math.PI / 2 : 0);
</script>

<T.Mesh
	position.x={x}
	position.y={y}
	position.z={hovered ? z + 0.02 : z}
	rotation.y={orientationRotation}
	rotation.z={tilt}
	material={materials}
	onclick={(e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		onOpen(book);
	}}
	onpointerenter={(e: { stopPropagation: () => void }) => {
		e.stopPropagation();
		hovered = true;
	}}
	onpointerleave={() => (hovered = false)}
>
	<T.BoxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH]} />
</T.Mesh>
