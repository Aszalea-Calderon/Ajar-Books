<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StarRating from '$lib/components/StarRating.svelte';
	import TagEditor from '$lib/components/TagEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusLabels: Record<string, string> = {
		want_to_read: 'Want to Read',
		reading: 'Currently Reading',
		finished: 'Finished',
		dnf: 'Did Not Finish'
	};

	// Intentionally a one-time snapshot: this only seeds the radio group's
	// initial selection, which the user then drives locally.
	let formatChoice = $state(untrack(() => data.userBook.format ?? 'physical'));
</script>

<svelte:head>
	<title>{data.book.title} — Ajar Books</title>
</svelte:head>

<div class="book-detail">
	<div class="book-detail__header">
		{#if data.book.coverUrl}
			<img class="book-detail__cover" src={data.book.coverUrl} alt="" />
		{:else}
			<div class="book-detail__cover book-detail__cover--placeholder"></div>
		{/if}
		<div>
			<h2>{data.book.title}</h2>
			{#if data.book.author}
				<p class="book-detail__author">{data.book.author}</p>
			{/if}
			<span class="book-detail__status">{statusLabels[data.userBook.status]}</span>
			<div class="book-detail__rating">
				<StarRating value={data.userBook.rating} />
			</div>
		</div>
		<form
			class="book-detail__delete-form"
			method="POST"
			action="?/delete"
			use:enhance
			onsubmit={(event) => {
				if (
					!confirm(`Delete "${data.book.title}" and all its logged progress? This can't be undone.`)
				) {
					event.preventDefault();
				}
			}}
		>
			<button class="book-detail__delete" type="submit">Delete</button>
		</form>
	</div>

	<div class="book-detail__panel">
		<TagEditor
			label="Genre"
			type="genre"
			tags={data.tagsByType.genre}
			suggestions={data.suggestionsByType.genre}
		/>
		<TagEditor
			label="Mood"
			type="mood"
			tags={data.tagsByType.mood}
			suggestions={data.suggestionsByType.mood}
		/>
		<TagEditor
			label="Setting"
			type="setting"
			tags={data.tagsByType.setting}
			suggestions={data.suggestionsByType.setting}
		/>
	</div>

	{#if !data.userBook.format}
		<div class="book-detail__panel">
			<h3>Set format</h3>
			<form method="POST" action="?/setFormat" use:enhance>
				<div class="format-picker">
					<label class="format-picker__option">
						<input type="radio" name="format" value="physical" bind:group={formatChoice} />
						Physical
					</label>
					<label class="format-picker__option">
						<input type="radio" name="format" value="ebook" bind:group={formatChoice} />
						Ebook
					</label>
					<label class="format-picker__option">
						<input type="radio" name="format" value="audiobook" bind:group={formatChoice} />
						Audiobook
					</label>
				</div>

				{#if formatChoice === 'audiobook'}
					<div class="auth-field">
						<label for="totalMinutes">Total length (minutes)</label>
						<input id="totalMinutes" name="totalMinutes" type="number" min="1" />
					</div>
				{:else}
					<div class="auth-field">
						<label for="totalPages">Total pages</label>
						<input id="totalPages" name="totalPages" type="number" min="1" />
					</div>
				{/if}

				<button class="auth-submit" type="submit">Save format</button>
			</form>
		</div>
	{:else}
		<div class="book-detail__panel">
			<h3>Progress</h3>
			<ProgressBar
				current={data.userBook.format === 'audiobook' ? data.totals.minutes : data.totals.pages}
				total={data.userBook.format === 'audiobook'
					? data.userBook.totalMinutes
					: data.userBook.totalPages}
				unit={data.userBook.format === 'audiobook' ? 'minutes' : 'pages'}
			/>

			<form method="POST" action="?/logProgress" use:enhance>
				{#if data.userBook.format === 'audiobook'}
					<div class="auth-field">
						<label for="minutesRead">Minutes listened</label>
						<input id="minutesRead" name="minutesRead" type="number" min="1" required />
					</div>
				{:else}
					<div class="auth-field">
						<label for="pagesRead">Pages read</label>
						<input id="pagesRead" name="pagesRead" type="number" min="1" required />
					</div>
				{/if}
				<div class="auth-field">
					<label for="note">Note (optional)</label>
					<input id="note" name="note" type="text" />
				</div>
				<button class="auth-submit" type="submit">Log progress</button>
			</form>
		</div>

		<div class="book-detail__panel">
			<h3>Activity</h3>
			{#if data.logs.length === 0}
				<p class="dashboard__empty">No progress logged yet.</p>
			{:else}
				<ul class="activity-log">
					{#each data.logs as log (log.id)}
						<li class="activity-log__entry">
							<span class="activity-log__date">
								{log.loggedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
							</span>
							<span class="activity-log__amount">
								{#if log.pagesRead}
									+{log.pagesRead} pages
								{:else if log.minutesRead}
									+{log.minutesRead} min
								{/if}
							</span>
							{#if log.note}
								<span class="activity-log__note">{log.note}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
