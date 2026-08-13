<script lang="ts">
	import { enhance } from '$app/forms';

	let { googleBooksApiKey }: { googleBooksApiKey: string | null } = $props();

	let justSaved = $state(false);
</script>

<h3>Google Books API Key</h3>
<p class="settings-hint">
	Optional — widens search results and improves cover art. Get a free key from the <a
		href="https://console.cloud.google.com/apis/library/books.googleapis.com"
		target="_blank"
		rel="noreferrer">Google Cloud Console</a
	>. Stored in your database, only ever sent to Google's API.
</p>
<form
	method="POST"
	action="/profile?/saveGoogleBooksKey"
	use:enhance={() => {
		justSaved = false;
		return async ({ update }) => {
			await update();
			justSaved = true;
		};
	}}
>
	<div class="auth-field">
		<label for="googleBooksApiKey">API Key</label>
		<input
			id="googleBooksApiKey"
			name="googleBooksApiKey"
			type="text"
			value={googleBooksApiKey ?? ''}
			placeholder="Not set"
			oninput={() => (justSaved = false)}
		/>
	</div>
	<button class="auth-submit" type="submit">Save</button>
	{#if justSaved}
		<p class="settings-hint settings-hint--success">Saved.</p>
	{/if}
</form>
