<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Set up Ajar Books</title>
</svelte:head>

<div class="auth-page">
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
					value={form?.username ?? ''}
					required
					minlength="3"
				/>
			</div>
			<div class="auth-field">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
				/>
			</div>
			<div class="auth-field">
				<label for="confirmPassword">Confirm password</label>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="8"
				/>
			</div>
			<button class="auth-submit" type="submit">Create account</button>
		</form>
	</div>
</div>
