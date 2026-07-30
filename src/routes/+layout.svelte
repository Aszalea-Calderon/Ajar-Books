<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import { initTheme } from '$lib/client/theme.svelte';
	import { initFont } from '$lib/client/font.svelte';
	import { initAccent } from '$lib/client/accent.svelte';
	import { searchViewMode, profileViewMode } from '$lib/client/viewMode.svelte';
	import { initBackgroundTexture } from '$lib/client/backgroundTexture.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initFont();
		initAccent();
		searchViewMode.init();
		profileViewMode.init();
		initBackgroundTexture();
	});
</script>

{@render children()}
