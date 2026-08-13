<script lang="ts">
	import { enhance } from '$app/forms';

	let { username }: { username: string } = $props();

	let usernameSaved = $state(false);
	let usernameError = $state<string | null>(null);
</script>

<h3>Username</h3>
<p class="settings-hint">Used to sign in — no email is on file for this app.</p>
<form
	method="POST"
	action="/profile?/updateUsername"
	use:enhance={() => {
		usernameSaved = false;
		usernameError = null;
		return async ({ update, result }) => {
			await update();
			if (result.type === 'failure' && result.data?.usernameError) {
				usernameError = result.data.usernameError as string;
			} else if (result.type === 'success') {
				usernameSaved = true;
			}
		};
	}}
>
	<div class="auth-field">
		<label for="username">Username</label>
		<input
			id="username"
			name="username"
			type="text"
			value={username}
			oninput={() => {
				usernameSaved = false;
				usernameError = null;
			}}
		/>
	</div>
	<button class="auth-submit" type="submit">Save</button>
	{#if usernameSaved}
		<p class="settings-hint settings-hint--success">Saved.</p>
	{:else if usernameError}
		<p class="settings-hint settings-hint--error">{usernameError}</p>
	{/if}
</form>
