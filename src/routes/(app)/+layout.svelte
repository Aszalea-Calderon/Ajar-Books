<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { clickOutside } from '$lib/clickOutside';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let initial = $derived(data.user?.username.charAt(0).toUpperCase() ?? '?');
	let accountMenuOpen = $state(false);
	let accountButton = $state<HTMLButtonElement>();
	let settingsOpen = $state(false);

	const navLinks = [
		{ label: 'Home', path: '/', href: resolve('/') },
		{ label: 'Insights', path: '/insights', href: resolve('/insights') },
		{ label: 'Search', path: '/search', href: resolve('/search') }
	];
</script>

<div class="app-shell">
	<header class="app-nav">
		<div class="app-nav__brand">
			<span class="app-nav__logo" aria-hidden="true"></span>
			Ajar Books
		</div>

		<nav class="app-nav__links">
			{#each navLinks as link (link.path)}
				<a
					class="app-nav__link"
					class:app-nav__link--active={page.url.pathname === link.path}
					href={link.href}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="app-nav__account" use:clickOutside={() => (accountMenuOpen = false)}>
			<button
				bind:this={accountButton}
				type="button"
				class="app-nav__avatar"
				title={data.user?.username}
				aria-haspopup="true"
				aria-expanded={accountMenuOpen}
				onclick={() => (accountMenuOpen = !accountMenuOpen)}
				onkeydown={(event) => {
					if (event.key !== 'Escape') return;
					accountMenuOpen = false;
				}}
			>
				{initial}
			</button>
			{#if accountMenuOpen}
				<div
					class="app-nav__account-menu"
					role="menu"
					tabindex="-1"
					onkeydown={(event) => {
						if (event.key !== 'Escape') return;
						accountMenuOpen = false;
						accountButton?.focus();
					}}
				>
					<a
						class="app-nav__account-option"
						role="menuitem"
						href={resolve('/profile')}
						onclick={() => (accountMenuOpen = false)}
					>
						Profile
					</a>
					<button
						type="button"
						class="app-nav__account-option"
						role="menuitem"
						onclick={() => {
							settingsOpen = true;
							accountMenuOpen = false;
						}}
					>
						Settings
					</button>
					<form method="POST" action="/logout">
						<button
							class="app-nav__account-option app-nav__account-option--danger"
							role="menuitem"
							type="submit"
						>
							Log out
						</button>
					</form>
				</div>
			{/if}
		</div>
	</header>

	<main class="app-main">
		{@render children()}
	</main>
</div>

<SettingsModal
	bind:open={settingsOpen}
	googleBooksApiKey={data.googleBooksApiKey}
	languagePriority={data.languagePriority}
	manageableTags={data.manageableTags}
/>
