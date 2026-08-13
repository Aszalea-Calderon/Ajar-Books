<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<h3>Import</h3>
<p class="settings-hint">
	Bring in your reading history from Goodreads, StoryGraph, or another CSV export.
</p>
<a class="settings-trigger" href={resolve('/(app)/import')}>Import your data</a>

<h3>Your Data</h3>
<p class="settings-hint">
	Download a full JSON snapshot of your library — every book, its tags, and its reading logs.
</p>
<a class="settings-trigger" href={resolve('/(app)/export')} download>Export your data</a>
