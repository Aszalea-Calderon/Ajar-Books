<script lang="ts">
	import { themeState, setTheme, type Theme } from '$lib/client/theme.svelte';
	import { fontState, setFont, type Font } from '$lib/client/font.svelte';
	import { accentState, setAccent, resetAccent } from '$lib/client/accent.svelte';
	import {
		backgroundTextureState,
		setBackgroundTexture,
		type BackgroundTexture
	} from '$lib/client/backgroundTexture.svelte';
	import {
		cardStyleState,
		setCardRadiusScale,
		setCardOpacity,
		setControlRadiusScale
	} from '$lib/client/cardStyle.svelte';
	import CustomThemesSection from './display/CustomThemesSection.svelte';
	import type { CustomTheme } from '$lib/server/customThemes';

	let {
		customThemes,
		onRequestConfirm
	}: {
		customThemes: CustomTheme[];
		onRequestConfirm: (event: MouseEvent, message: string, label?: string, confirmText?: string) => void;
	} = $props();

	const themes: { id: Theme; label: string }[] = [
		{ id: 'dark', label: 'Dark' },
		{ id: 'light', label: 'Light' }
	];

	const fonts: { id: Font; label: string }[] = [
		{ id: 'default', label: 'Default' },
		{ id: 'dyslexic', label: 'Dyslexia-friendly' }
	];

	const backgroundTextures: { id: BackgroundTexture; label: string }[] = [
		{ id: 'dotted', label: 'Dotted' },
		{ id: 'none', label: 'None' }
	];

	let defaultAccent = $derived(themeState.current === 'light' ? '#1d5fa8' : '#4c8edb');
</script>

<h3>Theme</h3>
<div class="theme-options">
	{#each themes as t (t.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={themeState.current === t.id}
			onclick={() => setTheme(t.id)}
		>
			<span class="theme-swatch theme-swatch--{t.id}"></span>
			{t.label}
		</button>
	{/each}
</div>

<h3>Accent Color</h3>
<p class="settings-hint">
	Pick a custom accent color — it replaces the theme's default blue for buttons, links, and
	highlights everywhere in the app.
</p>
<div class="accent-picker">
	<input
		class="accent-picker__input"
		type="color"
		value={accentState.custom ?? defaultAccent}
		oninput={(event) => setAccent((event.currentTarget as HTMLInputElement).value)}
	/>
	<button type="button" class="settings-trigger" onclick={resetAccent}> Reset to default </button>
</div>

<h3>Background Pattern</h3>
<p class="settings-hint">
	A faint dotted texture behind every page — purely decorative, turn it off if you'd rather have a
	plain background.
</p>
<div class="theme-options">
	{#each backgroundTextures as bg (bg.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={backgroundTextureState.current === bg.id}
			onclick={() => setBackgroundTexture(bg.id)}
		>
			<span class="theme-swatch theme-swatch--bg-{bg.id}"></span>
			{bg.label}
		</button>
	{/each}
</div>

<h3>Card Style</h3>
<p class="settings-hint">
	Corner rounding and background opacity for cards and panels (book cards, dashboard panels, book
	detail sections) — just the surfaces you browse, not buttons. Opacity only fades the
	background, never the text on top of it.
</p>
<div class="card-style-sliders">
	<label class="card-style-slider">
		<span class="card-style-slider__label">
			Corner rounding
			<span class="card-style-slider__value">{Math.round(cardStyleState.radiusScale * 100)}%</span>
		</span>
		<input
			type="range"
			min="0"
			max="2"
			step="0.05"
			value={cardStyleState.radiusScale}
			oninput={(event) => setCardRadiusScale(Number(event.currentTarget.value))}
		/>
	</label>
	<label class="card-style-slider">
		<span class="card-style-slider__label">
			Background opacity
			<span class="card-style-slider__value">{Math.round(cardStyleState.opacity * 100)}%</span>
		</span>
		<input
			type="range"
			min="0.5"
			max="1"
			step="0.05"
			value={cardStyleState.opacity}
			oninput={(event) => setCardOpacity(Number(event.currentTarget.value))}
		/>
	</label>
</div>

<h3>Action Buttons</h3>
<p class="settings-hint">
	Corner rounding for primary buttons (Save, Import, filter/view/sort triggers, theme swatches) —
	independent of Card Style above, so buttons can stay sharp on rounded cards or vice versa. Small
	icon-only buttons (delete, dismiss) keep their own fixed style.
</p>
<div class="card-style-sliders">
	<label class="card-style-slider">
		<span class="card-style-slider__label">
			Corner rounding
			<span class="card-style-slider__value"
				>{Math.round(cardStyleState.controlRadiusScale * 100)}%</span
			>
		</span>
		<input
			type="range"
			min="0"
			max="2"
			step="0.05"
			value={cardStyleState.controlRadiusScale}
			oninput={(event) => setControlRadiusScale(Number(event.currentTarget.value))}
		/>
	</label>
</div>

<h3>Font</h3>
<div class="theme-options">
	{#each fonts as f (f.id)}
		<button
			type="button"
			class="theme-option"
			class:theme-option--selected={fontState.current === f.id}
			onclick={() => setFont(f.id)}
		>
			<span class="font-preview font-preview--{f.id}">Aa</span>
			{f.label}
		</button>
	{/each}
</div>

<CustomThemesSection {customThemes} {onRequestConfirm} />
