<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { clickOutside } from '$lib/clickOutside';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let initial = $derived(data.user?.username.charAt(0).toUpperCase() ?? '?');
	let accountMenuOpen = $state(false);
	let accountButton = $state<HTMLButtonElement>();

	const navLinks = [
		{ label: 'Home', path: '/', href: resolve('/') },
		{ label: 'Insights', path: '/insights', href: resolve('/insights') },
		{ label: 'Search', path: '/search', href: resolve('/search') }
	];

	// Notification bell — see (app)/notifications/+server.ts. Seeded from the
	// layout's own server load so it's correct on first paint, then kept
	// current by polling the same endpoint (same pattern the Import page
	// uses for job progress) so an import finishing while you're on another
	// page still shows up without a full page reload.
	// Seeded once from the layout's own server load (correct on first paint,
	// including SSR), then owned locally from here on — refreshed by polling
	// below, not by re-reading `data` on some unrelated navigation, since a
	// layout reload for a different reason could otherwise clobber fresher
	// polled/optimistic state with an older snapshot.
	const NOTIFICATION_POLL_MS = 15000;
	let notifications = $state(data.notifications);
	let unreadCount = $state(data.unreadNotificationCount);
	let notificationsOpen = $state(false);
	let notificationsButton = $state<HTMLButtonElement>();

	async function refreshNotifications() {
		const res = await fetch(resolve('/(app)/notifications'));
		if (!res.ok) return;
		const body = await res.json();
		notifications = body.notifications;
		unreadCount = body.unreadCount;
	}

	async function toggleNotifications() {
		notificationsOpen = !notificationsOpen;
		if (notificationsOpen && unreadCount > 0) {
			await fetch(resolve('/(app)/notifications'), { method: 'POST' });
			unreadCount = 0;
			notifications = notifications.map((n) => (n.readAt ? n : { ...n, readAt: new Date() }));
		}
	}

	// Optimistic: removed from local state immediately, not on the next poll —
	// the request itself still runs, this just avoids a visible lag.
	async function dismissNotification(id: string) {
		const wasUnread = notifications.find((n) => n.id === id)?.readAt == null;
		notifications = notifications.filter((n) => n.id !== id);
		if (wasUnread) unreadCount = Math.max(0, unreadCount - 1);
		await fetch(resolve('/(app)/notifications/[id]', { id }), { method: 'DELETE' });
	}

	async function clearAllNotifications() {
		notifications = [];
		unreadCount = 0;
		await fetch(resolve('/(app)/notifications'), { method: 'DELETE' });
	}

	onMount(() => {
		const handle = setInterval(refreshNotifications, NOTIFICATION_POLL_MS);
		return () => clearInterval(handle);
	});
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

		<div class="app-nav__bell" use:clickOutside={() => (notificationsOpen = false)}>
			<button
				bind:this={notificationsButton}
				type="button"
				class="app-nav__bell-button"
				title="Notifications"
				aria-haspopup="true"
				aria-expanded={notificationsOpen}
				onclick={toggleNotifications}
				onkeydown={(event) => {
					if (event.key !== 'Escape') return;
					notificationsOpen = false;
				}}
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<path
						fill="currentColor"
						d="M12 22a2.25 2.25 0 0 0 2.236-2h-4.472A2.25 2.25 0 0 0 12 22ZM12 4a1 1 0 0 1 1 1v.68c2.61.57 4.5 2.89 4.5 5.62v3.2l1.7 2.3a1 1 0 0 1-.8 1.6H5.6a1 1 0 0 1-.8-1.6l1.7-2.3v-3.2c0-2.73 1.89-5.05 4.5-5.62V5a1 1 0 0 1 1-1Z"
					/>
				</svg>
				{#if unreadCount > 0}
					<span class="app-nav__bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
				{/if}
			</button>
			{#if notificationsOpen}
				<div
					class="app-nav__notifications"
					role="menu"
					aria-label="Notifications"
					tabindex="-1"
					onkeydown={(event) => {
						if (event.key !== 'Escape') return;
						notificationsOpen = false;
						notificationsButton?.focus();
					}}
				>
					{#if notifications.length === 0}
						<p class="app-nav__notifications-empty">Nothing yet.</p>
					{:else}
						<div class="app-nav__notifications-header">
							<button
								type="button"
								class="app-nav__notifications-clear"
								onclick={clearAllNotifications}
							>
								Clear all
							</button>
						</div>
						{#each notifications as notification (notification.id)}
							<div class="app-nav__notification">
								<div class="app-nav__notification-body">
									<p class="app-nav__notification-message">{notification.message}</p>
									<span class="app-nav__notification-time">
										{new Date(notification.createdAt).toLocaleString(undefined, {
											month: 'short',
											day: 'numeric',
											hour: 'numeric',
											minute: '2-digit'
										})}
									</span>
								</div>
								<button
									type="button"
									class="app-nav__notification-dismiss"
									aria-label="Dismiss notification"
									onclick={() => dismissNotification(notification.id)}
								>
									×
								</button>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

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
						My Library
					</a>
					<a
						class="app-nav__account-option"
						role="menuitem"
						href={resolve('/settings')}
						onclick={() => (accountMenuOpen = false)}
					>
						Settings
					</a>
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

	{#if !data.hasRecoveryKey}
		<div class="recovery-key-reminder">
			<p>
				You don't have a recovery key set up — if you ever forget your password, there's no way
				back in without one.
			</p>
			<a class="settings-trigger" href={resolve(`/settings?section=data`)}> Set one up now </a>
		</div>
	{/if}

	<main class="app-main">
		{@render children()}
	</main>
</div>
