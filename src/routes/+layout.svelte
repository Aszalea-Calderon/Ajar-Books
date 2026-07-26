<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initTheme } from '$lib/client/theme.svelte';
	import { initFont } from '$lib/client/font.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initFont();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
