<script lang="ts">
	import { themeState, setTheme, type Theme } from '$lib/client/theme.svelte';
	import { fontState, setFont, type Font } from '$lib/client/font.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let dialogEl: HTMLDialogElement;
	let section = $state<'themes' | 'fonts'>('themes');

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	const themes: { id: Theme; label: string }[] = [
		{ id: 'dark', label: 'Dark' },
		{ id: 'light', label: 'Light' }
	];

	const fonts: { id: Font; label: string }[] = [
		{ id: 'default', label: 'Default' },
		{ id: 'dyslexic', label: 'Dyslexia-friendly' }
	];

	function closeOnBackdropClick(event: MouseEvent) {
		if (event.target === dialogEl) open = false;
	}
</script>

<dialog
	bind:this={dialogEl}
	class="settings-modal"
	onclose={() => (open = false)}
	onclick={closeOnBackdropClick}
>
	<div class="settings-modal__header">
		<h2>Settings</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close settings"
			onclick={() => (open = false)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__body">
		<nav class="settings-modal__nav">
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'themes'}
				onclick={() => (section = 'themes')}
			>
				Themes
			</button>
			<button
				type="button"
				class="settings-modal__nav-item"
				class:settings-modal__nav-item--active={section === 'fonts'}
				onclick={() => (section = 'fonts')}
			>
				Fonts
			</button>
		</nav>
		<div class="settings-modal__content">
			{#if section === 'themes'}
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
			{:else}
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
			{/if}
		</div>
	</div>
</dialog>
