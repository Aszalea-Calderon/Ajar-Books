<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FormatModal from '$lib/components/FormatModal.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StarRating from '$lib/components/StarRating.svelte';
	import StatusControl from '$lib/components/StatusControl.svelte';
	import TagEditor from '$lib/components/TagEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const formatLabels: Record<string, string> = {
		physical: 'Physical',
		ebook: 'Ebook',
		audiobook: 'Audiobook'
	};

	type LogEntry = PageData['logs'][number];

	let formatModalMode = $state<'start' | 'change' | null>(null);
	let logModalOpen = $state(false);
	let logDialogEl: HTMLDialogElement;

	let editingLog = $state<LogEntry | null>(null);
	let editDialogEl: HTMLDialogElement;

	$effect(() => {
		if (!logDialogEl) return;
		if (logModalOpen && !logDialogEl.open) {
			logDialogEl.showModal();
		} else if (!logModalOpen && logDialogEl.open) {
			logDialogEl.close();
		}
	});

	$effect(() => {
		if (!editDialogEl) return;
		if (editingLog && !editDialogEl.open) {
			editDialogEl.showModal();
		} else if (!editingLog && editDialogEl.open) {
			editDialogEl.close();
		}
	});

	function closeLogModalOnBackdrop(event: MouseEvent) {
		if (event.target === logDialogEl) logModalOpen = false;
	}

	function closeEditModalOnBackdrop(event: MouseEvent) {
		if (event.target === editDialogEl) editingLog = null;
	}

	let subtitle = $derived(
		[data.book.author, data.userBook.format ? formatLabels[data.userBook.format] : null]
			.filter(Boolean)
			.join(' · ')
	);

	let isAudiobook = $derived(data.userBook.format === 'audiobook');
	let progressLabel = $derived(isAudiobook ? 'Listening progress' : 'Reading progress');
	let logButtonLabel = $derived(isAudiobook ? '+ Log listening' : '+ Log progress');
	let editingIsMinutes = $derived(editingLog?.minutesRead != null);
</script>

<svelte:head>
	<title>{data.book.title} — Ajar Books</title>
</svelte:head>

<div class="book-detail">
	<div class="book-detail__hero">
		<div class="book-detail__hero-actions">
			<form
				method="POST"
				action="?/removeBook"
				use:enhance
				onsubmit={(event) => {
					if (
						!confirm(
							`Remove "${data.book.title}" from your library? This clears its progress, format, and rating, but keeps it as a book you can start tracking again.`
						)
					) {
						event.preventDefault();
					}
				}}
			>
				<button class="book-detail__action" type="submit">Remove</button>
			</form>
			<form
				method="POST"
				action="?/delete"
				use:enhance
				onsubmit={(event) => {
					if (
						!confirm(
							`Delete "${data.book.title}" and all its logged progress? This can't be undone.`
						)
					) {
						event.preventDefault();
					}
				}}
			>
				<button class="book-detail__action book-detail__action--danger" type="submit">
					Delete
				</button>
			</form>
		</div>
		<div class="book-detail__hero-content">
			{#if data.book.coverUrl}
				<img class="book-detail__cover" src={data.book.coverUrl} alt="" />
			{:else}
				<div class="book-detail__cover book-detail__cover--placeholder"></div>
			{/if}
			<div>
				<h2>{data.book.title}</h2>
				{#if subtitle}
					<p class="book-detail__subtitle">{subtitle}</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="book-detail__body">
		<div class="book-detail__row">
			<div class="book-detail__row-left">
				<StatusControl status={data.userBook.status} />
				<StarRating value={data.userBook.rating} />
			</div>
			<div class="format-status">
				{#if data.userBook.format}
					<span class="format-status__label">{formatLabels[data.userBook.format]}</span>
					<button
						type="button"
						class="format-status__change"
						onclick={() => (formatModalMode = 'change')}
					>
						Change format
					</button>
				{:else}
					<button
						type="button"
						class="search-result__label"
						onclick={() => (formatModalMode = 'start')}
					>
						Start Reading
					</button>
				{/if}
			</div>
		</div>

		{#if data.userBook.format}
			<div class="book-detail__panel">
				<ProgressBar
					label={progressLabel}
					current={isAudiobook ? data.totals.minutes : data.totals.pages}
					total={isAudiobook ? data.userBook.totalMinutes : data.userBook.totalPages}
					unit={isAudiobook ? 'minutes' : 'pages'}
					variant="segments"
				/>
				<div class="progress-bar__actions">
					<button type="button" class="search-result__label" onclick={() => (logModalOpen = true)}>
						{logButtonLabel}
					</button>
				</div>
			</div>
		{/if}

		<div class="book-detail__columns">
			{#if data.book.description || data.book.author}
				<div class="book-detail__panel">
					<h3>About the book</h3>
					{#if data.book.description}
						<p class="book-detail__description">{data.book.description}</p>
					{/if}
					{#if data.book.author}
						<a
							class="book-detail__more-by-author"
							href={resolve(`/search?q=${encodeURIComponent(data.book.author)}`)}
						>
							More by {data.book.author}
						</a>
					{/if}
				</div>
			{/if}

			<div class="book-detail__panel tag-grid">
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
		</div>

		{#if data.userBook.status === 'reading' || data.userBook.status === 'finished' || data.logs.length > 0}
			<div class="book-detail__panel">
				<h3>Chapter Notes</h3>
				{#if data.logs.length === 0}
					<p class="dashboard__empty">No notes yet.</p>
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
								<button type="button" class="activity-log__edit" onclick={() => (editingLog = log)}>
									Edit
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if data.userBook.format}
					<div class="activity-log__footer">
						<button
							type="button"
							class="search-result__label"
							onclick={() => (logModalOpen = true)}
						>
							{logButtonLabel}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<FormatModal
	open={formatModalMode !== null}
	action={formatModalMode === 'start' ? '?/startReading' : '?/setFormat'}
	heading={formatModalMode === 'start' ? 'Start Reading' : 'Change Format'}
	submitLabel={formatModalMode === 'start' ? 'Start Reading' : 'Save'}
	currentFormat={data.userBook.format}
	currentTotalPages={data.userBook.totalPages}
	currentTotalMinutes={data.userBook.totalMinutes}
	suggestedPageCount={data.book.pageCount}
	onClose={() => (formatModalMode = null)}
/>

<dialog
	bind:this={logDialogEl}
	class="settings-modal"
	onclose={() => (logModalOpen = false)}
	onclick={closeLogModalOnBackdrop}
>
	<div class="settings-modal__header">
		<h2>{logButtonLabel.replace('+ ', '')}</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close"
			onclick={() => (logModalOpen = false)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		<form
			method="POST"
			action="?/logProgress"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					logModalOpen = false;
				};
			}}
		>
			{#if isAudiobook}
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
			<button class="auth-submit" type="submit">Log</button>
		</form>
	</div>
</dialog>

<dialog
	bind:this={editDialogEl}
	class="settings-modal"
	onclose={() => (editingLog = null)}
	onclick={closeEditModalOnBackdrop}
>
	<div class="settings-modal__header">
		<h2>Edit entry</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close"
			onclick={() => (editingLog = null)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		{#if editingLog}
			<form
				method="POST"
				action="?/editProgress"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						editingLog = null;
					};
				}}
			>
				<input type="hidden" name="logId" value={editingLog.id} />
				{#if editingIsMinutes}
					<div class="auth-field">
						<label for="editMinutesRead">Minutes listened</label>
						<input
							id="editMinutesRead"
							name="minutesRead"
							type="number"
							min="1"
							value={editingLog.minutesRead}
							required
						/>
					</div>
				{:else}
					<div class="auth-field">
						<label for="editPagesRead">Pages read</label>
						<input
							id="editPagesRead"
							name="pagesRead"
							type="number"
							min="1"
							value={editingLog.pagesRead}
							required
						/>
					</div>
				{/if}
				<div class="auth-field">
					<label for="editNote">Note (optional)</label>
					<input id="editNote" name="note" type="text" value={editingLog.note ?? ''} />
				</div>
				<button class="auth-submit" type="submit">Save</button>
			</form>
		{/if}
	</div>
</dialog>
