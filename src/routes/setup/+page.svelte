<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');

	$effect(() => {
		if (form?.username != null) username = form.username;
	});
</script>

<svelte:head>
	<title>Set up Ajar Books</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-page__brand">
		<span class="auth-page__logo" aria-hidden="true"></span>
		Ajar Books
	</div>
	<div class="auth-card">
		<h1>Create your account</h1>
		<p class="auth-switch" style="margin-top: 0; margin-bottom: var(--space-6); text-align: left;">
			This runs once, on first launch — Ajar Books doesn't support open sign-up.
		</p>

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
					minlength="3"
				/>
			</div>
			<PasswordField
				id="password"
				name="password"
				label="Password"
				autocomplete="new-password"
				required
				minlength={8}
				bind:value={password}
			/>
			<PasswordField
				id="confirmPassword"
				name="confirmPassword"
				label="Confirm password"
				autocomplete="new-password"
				required
				minlength={8}
				bind:value={confirmPassword}
			/>
			<button
				class="auth-submit"
				type="submit"
				disabled={!username || !password || !confirmPassword}
			>
				Create account
			</button>
		</form>
	</div>
</div>
