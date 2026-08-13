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
	import { initCardStyle } from '$lib/client/cardStyle.svelte';
	import { initGlassy } from '$lib/client/glassy.svelte';
	import { initDensity } from '$lib/client/density.svelte';
	import { initCardShadow } from '$lib/client/cardShadow.svelte';
	import { initCoverStyle } from '$lib/client/coverStyle.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initFont();
		initAccent();
		searchViewMode.init();
		profileViewMode.init();
		initBackgroundTexture();
		initCardStyle();
		initGlassy();
		initDensity();
		initCardShadow();
		initCoverStyle();
	});
</script>

{@render children()}
