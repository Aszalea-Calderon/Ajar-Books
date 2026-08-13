<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let recoveryKey = $state('');
	let password = $state('');
	let confirmPassword = $state('');
</script>

<svelte:head>
	<title>Recover your account — Ajar Books</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-page__brand">
		<span class="auth-page__logo" aria-hidden="true"></span>
		Ajar Books
	</div>
	<div class="auth-card">
		<h1>Recover your account</h1>
		<p class="settings-hint">
			Enter the recovery key from Settings &gt; Account Recovery, and choose a new password.
		</p>

		{#if form?.error}
			<p class="auth-error">{form.error}</p>
		{/if}

		<form method="POST" use:enhance>
			<div class="auth-field">
				<label for="recoveryKey">Recovery key</label>
				<input
					id="recoveryKey"
					name="recoveryKey"
					type="text"
					autocomplete="off"
					placeholder="XXXX-XXXX-XXXX-XXXX"
					bind:value={recoveryKey}
					required
				/>
			</div>
			<PasswordField
				id="password"
				name="password"
				label="New password"
				autocomplete="new-password"
				minlength={8}
				required
				bind:value={password}
			/>
			<PasswordField
				id="confirmPassword"
				name="confirmPassword"
				label="Confirm new password"
				autocomplete="new-password"
				required
				bind:value={confirmPassword}
			/>
			<button
				class="auth-submit"
				type="submit"
				disabled={!recoveryKey || !password || !confirmPassword}
			>
				Reset password
			</button>
		</form>
		<p class="settings-hint">
			<a href={resolve('/login')}>Back to sign in</a>
		</p>
	</div>
</div>
