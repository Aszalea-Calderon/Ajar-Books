<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in — Ajar Books</title>
</svelte:head>

<div class="auth-page">
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
					value={form?.username ?? ''}
					required
				/>
			</div>
			<div class="auth-field">
				<label for="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</div>
			<button class="auth-submit" type="submit">Sign in</button>
		</form>
	</div>
</div>
