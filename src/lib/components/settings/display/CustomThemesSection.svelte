<script lang="ts">
	import { enhance } from '$app/forms';
	import { themeState, setTheme } from '$lib/client/theme.svelte';
	import { accentState, setAccent, resetAccent } from '$lib/client/accent.svelte';
	import { backgroundTextureState, setBackgroundTexture } from '$lib/client/backgroundTexture.svelte';
	import { fontState, setFont } from '$lib/client/font.svelte';
	import {
		cardStyleState,
		setCardRadiusScale,
		setCardOpacity,
		setControlRadiusScale
	} from '$lib/client/cardStyle.svelte';
	import { glassyState, setGlassy } from '$lib/client/glassy.svelte';
	import { densityState, setDensity } from '$lib/client/density.svelte';
	import { cardShadowState, setCardShadow } from '$lib/client/cardShadow.svelte';
	import { coverStyleState, setCoverRadiusScale } from '$lib/client/coverStyle.svelte';
	import { cardBorderState, setCardBorder } from '$lib/client/cardBorder.svelte';
	import { textScaleState, setTextScale } from '$lib/client/textScale.svelte';
	import type { CustomTheme } from '$lib/server/customThemes';

	let {
		customThemes,
		onRequestConfirm
	}: {
		customThemes: CustomTheme[];
		onRequestConfirm: (event: MouseEvent, message: string, label?: string, confirmText?: string) => void;
	} = $props();

	let themeName = $state('');
	let saveError = $state<string | null>(null);
	let justSaved = $state(false);

	// Every Display knob is a plain reactive $state store, so these hidden
	// fields always reflect whatever the browser's current live look is at
	// the moment of submit — no separate "capture current state" step needed.

	function applyCustomTheme(saved: CustomTheme) {
		setTheme(saved.theme);
		if (saved.accentColor) setAccent(saved.accentColor);
		else resetAccent();
		setBackgroundTexture(saved.backgroundTexture);
		setFont(saved.font);
		setCardRadiusScale(saved.cardRadiusScale);
		setCardOpacity(saved.cardOpacity);
		setControlRadiusScale(saved.controlRadiusScale);
		setGlassy(saved.glassy);
		setDensity(saved.density);
		setCardShadow(saved.cardShadow);
		setCoverRadiusScale(saved.coverRadiusScale);
		setCardBorder(saved.cardBorder);
		setTextScale(saved.textScale);
	}
</script>

<h3>Custom Themes</h3>
<p class="settings-hint">
	Save the current Theme/Accent/Background/Font/Card Style/Action Button combination under a name,
	and switch between as many as you like.
</p>

{#if customThemes.length > 0}
	<ul class="custom-theme-list">
		{#each customThemes as saved (saved.id)}
			<li class="custom-theme-row">
				<button
					type="button"
					class="custom-theme-row__swatch"
					style="background: {saved.accentColor ?? (saved.theme === 'light' ? '#1d5fa8' : '#4c8edb')}"
					aria-label="Apply {saved.name}"
					title="Apply {saved.name}"
					onclick={() => applyCustomTheme(saved)}
				></button>
				<button type="button" class="custom-theme-row__name" onclick={() => applyCustomTheme(saved)}>
					{saved.name}
				</button>
				<form method="POST" action="/profile?/deleteCustomTheme" use:enhance>
					<input type="hidden" name="id" value={saved.id} />
					<button
						type="button"
						class="manage-tags__delete"
						aria-label="Delete {saved.name}"
						title="Delete {saved.name}"
						onclick={(event) => onRequestConfirm(event, `Delete the saved theme "${saved.name}"?`, 'Delete')}
					>
						<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
							<path
								fill="currentColor"
								d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
							/>
						</svg>
					</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<form
	method="POST"
	action="/profile?/saveCustomTheme"
	use:enhance={() => {
		saveError = null;
		justSaved = false;
		return async ({ update, result }) => {
			await update();
			if (result.type === 'failure' && result.data?.customThemeError) {
				saveError = result.data.customThemeError as string;
			} else if (result.type === 'success') {
				justSaved = true;
				themeName = '';
			}
		};
	}}
>
	<input type="hidden" name="theme" value={themeState.current} />
	<input type="hidden" name="accentColor" value={accentState.custom ?? ''} />
	<input type="hidden" name="backgroundTexture" value={backgroundTextureState.current} />
	<input type="hidden" name="font" value={fontState.current} />
	<input type="hidden" name="cardRadiusScale" value={cardStyleState.radiusScale} />
	<input type="hidden" name="cardOpacity" value={cardStyleState.opacity} />
	<input type="hidden" name="controlRadiusScale" value={cardStyleState.controlRadiusScale} />
	<input type="hidden" name="glassy" value={glassyState.enabled} />
	<input type="hidden" name="density" value={densityState.current} />
	<input type="hidden" name="cardShadow" value={cardShadowState.current} />
	<input type="hidden" name="coverRadiusScale" value={coverStyleState.radiusScale} />
	<input type="hidden" name="cardBorder" value={cardBorderState.current} />
	<input type="hidden" name="textScale" value={textScaleState.scale} />
	<div class="auth-field">
		<label for="customThemeName">Save current look as</label>
		<input
			id="customThemeName"
			name="name"
			type="text"
			placeholder="e.g. Cozy Evening"
			bind:value={themeName}
			oninput={() => {
				saveError = null;
				justSaved = false;
			}}
		/>
	</div>
	<button class="auth-submit" type="submit" disabled={!themeName.trim()}>Save theme</button>
	{#if justSaved}
		<p class="settings-hint settings-hint--success">Saved.</p>
	{:else if saveError}
		<p class="settings-hint settings-hint--error">{saveError}</p>
	{/if}
</form>
