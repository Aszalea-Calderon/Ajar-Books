<script lang="ts">
	import { enhance } from '$app/forms';
	import PasswordField from '$lib/components/PasswordField.svelte';

	let passwordSaved = $state(false);
	let passwordError = $state<string | null>(null);
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmNewPassword = $state('');
</script>

<h3>Change Password</h3>
<p class="settings-hint">Requires your current password.</p>
<form
	method="POST"
	action="/profile?/updatePassword"
	use:enhance={() => {
		passwordSaved = false;
		passwordError = null;
		return async ({ update, result }) => {
			await update();
			if (result.type === 'failure' && result.data?.passwordError) {
				passwordError = result.data.passwordError as string;
			} else if (result.type === 'success') {
				passwordSaved = true;
				currentPassword = '';
				newPassword = '';
				confirmNewPassword = '';
			}
		};
	}}
>
	<PasswordField
		id="currentPassword"
		name="currentPassword"
		label="Current password"
		autocomplete="current-password"
		required
		bind:value={currentPassword}
	/>
	<PasswordField
		id="newPassword"
		name="newPassword"
		label="New password"
		autocomplete="new-password"
		required
		minlength={8}
		bind:value={newPassword}
	/>
	<PasswordField
		id="confirmNewPassword"
		name="confirmNewPassword"
		label="Confirm new password"
		autocomplete="new-password"
		required
		bind:value={confirmNewPassword}
	/>
	<button class="auth-submit" type="submit">Change password</button>
	{#if passwordSaved}
		<p class="settings-hint settings-hint--success">Password changed.</p>
	{:else if passwordError}
		<p class="settings-hint settings-hint--error">{passwordError}</p>
	{/if}
</form>
