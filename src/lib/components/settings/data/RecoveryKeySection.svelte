<script lang="ts">
	import { enhance } from '$app/forms';

	let { hasRecoveryKey }: { hasRecoveryKey: boolean } = $props();

	let recoveryKeyRunning = $state(false);
	let generatedRecoveryKey = $state<string | null>(null);
</script>

<h3>Account Recovery</h3>
<p class="settings-hint">
	A recovery key lets you reset your password if you're ever locked out — this app has no
	email-based recovery, so it's the only way back in. Generating a new key invalidates any
	previous one.
</p>
{#if generatedRecoveryKey}
	<p class="settings-hint settings-hint--success">
		Your new recovery key — save it somewhere safe now, it won't be shown again:
	</p>
	<p class="recovery-key-display">{generatedRecoveryKey}</p>
{:else if hasRecoveryKey}
	<p class="settings-hint">A recovery key is set.</p>
{:else}
	<p class="settings-hint">No recovery key set yet.</p>
{/if}
<form
	method="POST"
	action="/profile?/generateRecoveryKey"
	use:enhance={() => {
		recoveryKeyRunning = true;
		return async ({ update, result }) => {
			await update();
			recoveryKeyRunning = false;
			if (result.type === 'success' && result.data?.recoveryKey) {
				generatedRecoveryKey = result.data.recoveryKey as string;
			}
		};
	}}
>
	<button class="settings-trigger" type="submit" disabled={recoveryKeyRunning}>
		{recoveryKeyRunning
			? 'Generating…'
			: hasRecoveryKey || generatedRecoveryKey
				? 'Generate a new key'
				: 'Generate recovery key'}
	</button>
</form>
