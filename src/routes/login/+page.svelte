<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let username = $state('');
	let password = $state('');

	$effect(() => {
		if (form?.username != null) username = form.username;
	});
</script>

<svelte:head>
	<title>Sign in — Ajar Books</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-page__brand">
		<span class="auth-page__logo" aria-hidden="true"></span>
		Ajar Books
	</div>
	<div class="auth-card">
		<h1>Sign in</h1>

		{#if form?.error}
			<p class="auth-error">{form.error}</p>
		{/if}

		<form method="POST" use:enhance>
			<div class="auth-field">
				<label for="username">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					bind:value={username}
					required
				/>
			</div>
			<PasswordField
				id="password"
				name="password"
				label="Password"
				autocomplete="current-password"
				required
				bind:value={password}
			/>
			<button class="auth-submit" type="submit" disabled={!username || !password}> Sign in </button>
		</form>
		<p class="settings-hint">
			<a href={resolve('/recover')}>Forgot your password?</a>
		</p>
	</div>
</div>
