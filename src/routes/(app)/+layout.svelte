<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let initial = $derived(data.user?.username.charAt(0).toUpperCase() ?? '?');

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

		<div class="app-nav__account">
			<a class="app-nav__avatar" href={resolve('/profile')} title={data.user?.username}>{initial}</a
			>
			<form method="POST" action="/logout">
				<button class="app-nav__logout" type="submit">Log out</button>
			</form>
		</div>
	</header>

	<main class="app-main">
		{@render children()}
	</main>
</div>
