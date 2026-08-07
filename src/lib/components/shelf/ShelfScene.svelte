<script lang="ts">
	import { Canvas } from '@threlte/core';
	import * as THREE from 'three';
	import ShelfSceneContent from './ShelfSceneContent.svelte';
	import type { ShelfBook } from '$lib/client/shelf/bookTextures';
	import type { ShelfOrientation } from '$lib/client/shelf/layout';

	type Book = ShelfBook & { coverUrl: string | null; isbn: string | null };

	let {
		books,
		scrollY,
		orientation,
		onOpen
	}: {
		books: Book[];
		scrollY: number;
		orientation: ShelfOrientation;
		onOpen: (book: Book) => void;
	} = $props();
</script>

<Canvas
	toneMapping={THREE.NoToneMapping}
	renderMode="on-demand"
	createRenderer={(canvas) => new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })}
>
	<ShelfSceneContent {books} {scrollY} {orientation} {onOpen} />
</Canvas>
