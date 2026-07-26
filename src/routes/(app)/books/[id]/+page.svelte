<script lang="ts">
	import { enhance } from '$app/forms';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StarRating from '$lib/components/StarRating.svelte';
	import TagEditor from '$lib/components/TagEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const statusOptions = [
		{ id: 'want_to_read', label: 'Want to Read' },
		{ id: 'reading', label: 'Currently Reading' },
		{ id: 'finished', label: 'Finished' },
		{ id: 'dnf', label: 'Did Not Finish' }
	] as const;

	const formatLabels: Record<string, string> = {
		physical: 'Physical',
		ebook: 'Ebook',
		audiobook: 'Audiobook'
	};

	const formats = ['physical', 'ebook', 'audiobook'] as const;
	type Format = (typeof formats)[number];
	type LogEntry = PageData['logs'][number];

	let pendingFormat = $state<Format | null>(null);
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

	let pendingTotalDefault = $derived.by(() => {
		if (pendingFormat === data.userBook.format) {
			return pendingFormat === 'audiobook' ? data.userBook.totalMinutes : data.userBook.totalPages;
		}
		// Picking a fresh (not previously saved) physical/ebook format: suggest
		// the page count pulled from Open Library/Google Books, if we have one.
		// No equivalent source exists for audiobook runtime, so that stays blank.
		if (pendingFormat && pendingFormat !== 'audiobook') {
			return data.book.pageCount;
		}
		return null;
	});

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
				<form method="POST" action="?/setStatus" use:enhance>
					<select
						class="status-control"
						name="status"
						value={data.userBook.status}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						{#each statusOptions as s (s.id)}
							<option value={s.id}>{s.label}</option>
						{/each}
					</select>
				</form>
				<StarRating value={data.userBook.rating} />
			</div>
			<div class="format-toggle">
				{#each formats as f (f)}
					<button
						type="button"
						class="format-toggle__pill"
						class:format-toggle__pill--active={data.userBook.format === f}
						onclick={() => (pendingFormat = pendingFormat === f ? null : f)}
					>
						{formatLabels[f]}
					</button>
				{/each}
			</div>
		</div>

		{#if pendingFormat}
			<form
				method="POST"
				action="?/setFormat"
				class="format-total-form"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						pendingFormat = null;
					};
				}}
			>
				<input type="hidden" name="format" value={pendingFormat} />
				<label for="totalAmount">
					{pendingFormat === 'audiobook' ? 'Total length (minutes)' : 'Total pages'}
				</label>
				<input
					id="totalAmount"
					name={pendingFormat === 'audiobook' ? 'totalMinutes' : 'totalPages'}
					type="number"
					min="1"
					value={pendingTotalDefault}
				/>
				<button class="auth-submit" type="submit">Save</button>
			</form>
		{/if}

		{#if data.userBook.format && !pendingFormat}
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
			{#if data.book.description}
				<div class="book-detail__panel">
					<h3>About the book</h3>
					<p class="book-detail__description">{data.book.description}</p>
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
