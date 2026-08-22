<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/700.css';
	import '@fontsource/atkinson-hyperlegible/400.css';
	import '@fontsource/atkinson-hyperlegible/700.css';
	import '@fontsource/merriweather/400.css';
	import '@fontsource/merriweather/700.css';
	import '@fontsource/lora/400.css';
	import '@fontsource/lora/700.css';
	import '@fontsource/nunito/400.css';
	import '@fontsource/nunito/700.css';
	import { initTheme } from '$lib/client/theme.svelte';
	import { initFont } from '$lib/client/font.svelte';
	import { initAccent } from '$lib/client/accent.svelte';
	import { searchViewMode, profileViewMode, insightsViewMode } from '$lib/client/viewMode.svelte';
	import { initBackgroundTexture } from '$lib/client/backgroundTexture.svelte';
	import { initCardStyle } from '$lib/client/cardStyle.svelte';
	import { initGlassy } from '$lib/client/glassy.svelte';
	import { initDensity } from '$lib/client/density.svelte';
	import { initCardShadow } from '$lib/client/cardShadow.svelte';
	import { initCoverStyle } from '$lib/client/coverStyle.svelte';
	import { initCardBorder } from '$lib/client/cardBorder.svelte';
	import { initTextScale } from '$lib/client/textScale.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
		initFont();
		initAccent();
		searchViewMode.init();
		profileViewMode.init();
		insightsViewMode.init();
		initBackgroundTexture();
		initCardStyle();
		initGlassy();
		initDensity();
		initCardShadow();
		initCoverStyle();
		initCardBorder();
		initTextScale();
	});
</script>

{@render children()}
