<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { toLocalDateInputValue, todayLocalDateString } from '$lib/date';
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

	let noteModalOpen = $state(false);
	let noteDialogEl: HTMLDialogElement;

	let editingLog = $state<LogEntry | null>(null);
	let editDialogEl: HTMLDialogElement;

	// Follow-up prompt: pops open the first time status transitions to
	// 'finished' during this page's lifetime (whether via the automatic
	// progress-crossed-the-goal path or a manual status-pill click) — not on
	// every later visit to an already-finished book.
	let finishedModalOpen = $state(false);
	let finishedDialogEl: HTMLDialogElement;
	let finishedRating = $state(0);
	let finishedDate = $state('');
	let lastSeenStatus = $state<typeof data.userBook.status | null>(null);

	$effect(() => {
		const current = data.userBook.status;
		if (current === 'finished' && lastSeenStatus !== null && lastSeenStatus !== 'finished') {
			finishedRating = data.userBook.rating ?? 0;
			finishedDate = data.userBook.finishedAt
				? toLocalDateInputValue(data.userBook.finishedAt)
				: todayLocalDateString();
			finishedModalOpen = true;
		}
		lastSeenStatus = current;
	});

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

	$effect(() => {
		if (!finishedDialogEl) return;
		if (finishedModalOpen && !finishedDialogEl.open) {
			finishedDialogEl.showModal();
		} else if (!finishedModalOpen && finishedDialogEl.open) {
			finishedDialogEl.close();
		}
	});

	$effect(() => {
		if (!noteDialogEl) return;
		if (noteModalOpen && !noteDialogEl.open) {
			noteDialogEl.showModal();
		} else if (!noteModalOpen && noteDialogEl.open) {
			noteDialogEl.close();
		}
	});

	function closeLogModalOnBackdrop(event: MouseEvent) {
		if (event.target === logDialogEl) logModalOpen = false;
	}

	function closeEditModalOnBackdrop(event: MouseEvent) {
		if (event.target === editDialogEl) editingLog = null;
	}

	function closeFinishedModalOnBackdrop(event: MouseEvent) {
		if (event.target === finishedDialogEl) finishedModalOpen = false;
	}

	function closeNoteModalOnBackdrop(event: MouseEvent) {
		if (event.target === noteDialogEl) noteModalOpen = false;
	}

	let subtitle = $derived(
		[data.book.author, data.userBook.format ? formatLabels[data.userBook.format] : null]
			.filter(Boolean)
			.join(' · ')
	);

	let resetConfirmMessage = $derived(
		`Reset "${data.book.title}"? This clears its progress, format, and rating. Any notes you've added will be kept.`
	);

	let isUntouched = $derived(data.userBook.status === 'added');
	// finishedAt is never cleared by a later manual status change (see
	// setStatus), so its presence alongside 'reading' means this is a
	// reread, not a first read — the automatic pages/minutes-based
	// recomputeStatus path is the one exception, which does null it out
	// when a correction drops a book back under its goal (not a real reread).
	let isRereading = $derived(data.userBook.status === 'reading' && !!data.userBook.finishedAt);
	// Once finished (or given up on), the tracker's done its job — hide it
	// rather than show a stale bar. It reappears automatically if status
	// moves away from these again (e.g. a manual "Currently Reading" for a
	// reread).
	let showTracker = $derived(
		!!data.userBook.format && data.userBook.status !== 'finished' && data.userBook.status !== 'dnf'
	);
	let isAudiobook = $derived(data.userBook.format === 'audiobook');
	let progressLabel = $derived(isAudiobook ? 'Listening progress' : 'Reading progress');
	let logButtonLabel = $derived(isAudiobook ? '+ Log listening' : '+ Log progress');
	// The entry that actually drives the progress bar's current total — lets
	// "edit reading progress" jump straight to correcting it, without
	// scrolling down to find the right Chapter Notes entry by hand.
	let latestProgressLog = $derived(
		data.logs.find((log) => log.pagesRead != null || log.minutesRead != null) ?? null
	);
	let editingIsMinutes = $derived(editingLog?.minutesRead != null);
</script>

<svelte:head>
	<title>{data.book.title} — Ajar Books</title>
</svelte:head>

<div class="book-detail">
	<div class="book-detail__hero">
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
		{#if !data.userBook.format}
			<div class="book-detail__hero-cta">
				<button
					type="button"
					class="search-result__label"
					onclick={() => (formatModalMode = 'start')}
				>
					Start Reading
				</button>
			</div>
		{/if}
	</div>

	<div class="book-detail__body">
		<div class="book-detail__row">
			<div class="book-detail__row-left">
				<StatusControl
					status={data.userBook.status}
					{resetConfirmMessage}
					onReadingClick={() => (formatModalMode = 'start')}
					onFinishedClick={() => {
						finishedRating = data.userBook.rating ?? 0;
						finishedDate = data.userBook.finishedAt
							? toLocalDateInputValue(data.userBook.finishedAt)
							: todayLocalDateString();
						finishedModalOpen = true;
					}}
				/>
				{#if !isUntouched}
					<StarRating value={data.userBook.rating} />
					{#if isRereading}
						<span class="reread-badge">
							Re-reading · Last finished {data.userBook.finishedAt?.toLocaleDateString(undefined, {
								month: 'short',
								day: 'numeric',
								year: 'numeric'
							})}
						</span>
					{/if}
					<form
						method="POST"
						action="?/removeBook"
						use:enhance
						onsubmit={(event) => {
							if (!confirm(resetConfirmMessage)) {
								event.preventDefault();
							}
						}}
					>
						<button
							type="submit"
							class="book-detail__reset-trigger"
							aria-label="Reset this book's progress"
							title="Reset this book's progress"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
								<path
									fill="currentColor"
									d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
								/>
							</svg>
						</button>
					</form>
				{/if}
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
				{/if}
			</div>
		</div>

		{#if showTracker}
			<div class="book-detail__panel">
				<ProgressBar
					label={progressLabel}
					current={isAudiobook ? data.totals.minutes : data.totals.pages}
					total={isAudiobook ? data.userBook.totalMinutes : data.userBook.totalPages}
					unit={isAudiobook ? 'minutes' : 'pages'}
					variant="segments"
				/>
				<div class="progress-bar__actions">
					{#if latestProgressLog}
						<button
							type="button"
							class="book-detail__reset-trigger"
							aria-label="Edit reading progress"
							title="Edit reading progress"
							onclick={() => (editingLog = latestProgressLog)}
						>
							<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
								<path
									fill="currentColor"
									d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
								/>
							</svg>
						</button>
					{/if}
					<button type="button" class="search-result__label" onclick={() => (logModalOpen = true)}>
						{logButtonLabel}
					</button>
				</div>
			</div>
		{/if}

		<div class="book-detail__columns">
			<div class="book-detail__panel">
				<h3>About the book</h3>
				{#if data.book.description}
					<p class="book-detail__description">{data.book.description}</p>
				{:else}
					<p class="book-detail__description book-detail__description--empty">
						We're not sure — no description found for this book yet.
					</p>
				{/if}
				{#if data.book.author}
					<div class="more-by-author">
						<div class="more-by-author__header">
							<h4>More by {data.book.author}</h4>
						</div>
						{#await data.moreByAuthor}
							<p class="more-by-author__loading">
								<span class="spinner spinner--muted"></span> Loading…
							</p>
						{:then preview}
							{#if preview.length === 0}
								<p class="more-by-author__empty">
									We couldn't find any other books by {data.book.author}.
								</p>
							{:else}
								<div class="more-by-author__list">
									{#each preview as book (book.title)}
										<a
											class="more-by-author__book"
											href={book.libraryBookId
												? resolve('/(app)/books/[id]', { id: book.libraryBookId })
												: resolve(`/search?q=${encodeURIComponent(book.title)}`)}
											title={book.title}
										>
											{#if book.coverUrl}
												<img class="more-by-author__cover" src={book.coverUrl} alt="" />
											{:else}
												<div class="more-by-author__cover more-by-author__cover--placeholder"></div>
											{/if}
										</a>
									{/each}
									<a
										class="more-by-author__view-more"
										href={resolve(`/search?q=${encodeURIComponent(data.book.author)}`)}
									>
										View more
									</a>
								</div>
							{/if}
						{/await}
					</div>
				{/if}
			</div>

			<div class="book-detail__panel tag-grid">
				{#if data.book.pageCount || data.book.publicationYear}
					<p class="book-detail__facts">
						{#if data.book.pageCount}
							<span>{data.book.pageCount} pages</span>
						{/if}
						{#if data.book.pageCount && data.book.publicationYear}
							<span class="book-detail__facts-divider" aria-hidden="true">&bull;</span>
						{/if}
						{#if data.book.publicationYear}
							<span>Published {data.book.publicationYear}</span>
						{/if}
					</p>
				{/if}
				<TagEditor
					label="Genre"
					type="genre"
					tags={data.tagsByType.genre}
					suggestions={data.suggestionsByType.genre}
				/>
				{#if data.otherBooksByAuthorInLibrary.length > 0}
					<div class="also-by-author">
						<h4 class="also-by-author__label">Also by {data.book.author} in your library</h4>
						<div class="also-by-author__list">
							{#each data.otherBooksByAuthorInLibrary as book (book.id)}
								<a
									class="also-by-author__book"
									href={resolve('/(app)/books/[id]', { id: book.id })}
									title={book.title}
								>
									{#if book.coverUrl}
										<img class="also-by-author__cover" src={book.coverUrl} alt="" />
									{:else}
										<div class="also-by-author__cover also-by-author__cover--placeholder"></div>
									{/if}
								</a>
							{/each}
						</div>
					</div>
				{/if}
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

		{#if data.userBook.status === 'reading' || data.userBook.status === 'finished' || data.userBook.status === 'dnf' || data.logs.length > 0}
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
								<button
									type="button"
									class="activity-log__icon-button"
									aria-label="Edit entry"
									title="Edit entry"
									onclick={() => (editingLog = log)}
								>
									<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
										<path
											fill="currentColor"
											d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"
										/>
									</svg>
								</button>
								<form
									method="POST"
									action="?/deleteLog"
									use:enhance
									onsubmit={(event) => {
										if (!confirm('Delete this entry? This cannot be undone.')) {
											event.preventDefault();
										}
									}}
								>
									<input type="hidden" name="logId" value={log.id} />
									<button
										type="submit"
										class="activity-log__icon-button activity-log__icon-button--danger"
										aria-label="Delete entry"
										title="Delete entry"
									>
										<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
											<path
												fill="currentColor"
												d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
											/>
										</svg>
									</button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="activity-log__footer">
					{#if showTracker}
						<button
							type="button"
							class="search-result__label"
							onclick={() => (logModalOpen = true)}
						>
							{logButtonLabel}
						</button>
					{/if}
					<button
						type="button"
						class="activity-log__add-note"
						onclick={() => (noteModalOpen = true)}
					>
						+ Add note
					</button>
				</div>
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
	showStartDate={formatModalMode === 'start'}
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
				<p class="settings-hint">
					You left off at {Math.floor(data.totals.minutes / 60)}h {data.totals.minutes % 60}m.
				</p>
				<div class="log-progress__time-fields">
					<div class="auth-field">
						<label for="hoursListened">Hours</label>
						<input
							id="hoursListened"
							name="hours"
							type="number"
							min="0"
							value={Math.floor(data.totals.minutes / 60)}
							required
						/>
					</div>
					<div class="auth-field">
						<label for="minutesListened">Minutes</label>
						<input
							id="minutesListened"
							name="minutes"
							type="number"
							min="0"
							max="59"
							value={data.totals.minutes % 60}
							required
						/>
					</div>
				</div>
			{:else}
				<p class="settings-hint">You left off on page {data.totals.pages}.</p>
				<div class="auth-field">
					<label for="currentPage">What page are you on?</label>
					<input
						id="currentPage"
						name="currentPage"
						type="number"
						min="1"
						value={data.totals.pages || ''}
						required
					/>
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

<dialog
	bind:this={finishedDialogEl}
	class="settings-modal"
	onclose={() => (finishedModalOpen = false)}
	onclick={closeFinishedModalOnBackdrop}
>
	<div class="settings-modal__header">
		<h2>Nice, you finished it!</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close"
			onclick={() => (finishedModalOpen = false)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		<form
			method="POST"
			action="?/confirmFinished"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					finishedModalOpen = false;
				};
			}}
		>
			<div class="auth-field">
				<label for="finishedRatingInput">Your rating</label>
				<div class="star-rating">
					{#each [1, 2, 3, 4, 5] as star (star)}
						<span
							class="star-rating__star"
							style="--fill: {Math.max(0, Math.min(1, finishedRating - (star - 1))) * 100}%"
						>
							<button
								type="button"
								class="star-rating__half star-rating__half--left"
								onclick={() => (finishedRating = star - 0.5)}
								aria-label="Rate {star - 0.5} stars"
							></button>
							<button
								type="button"
								class="star-rating__half star-rating__half--right"
								onclick={() => (finishedRating = star)}
								aria-label="Rate {star} stars"
							></button>
						</span>
					{/each}
				</div>
				<input id="finishedRatingInput" type="hidden" name="rating" value={finishedRating} />
			</div>
			<div class="auth-field">
				<label for="finishedDateInput">Date finished</label>
				<input
					id="finishedDateInput"
					name="finishedAt"
					type="date"
					max={todayLocalDateString()}
					bind:value={finishedDate}
				/>
			</div>
			<div class="auth-field">
				<label for="finishedNoteInput">Any closing thoughts? (optional)</label>
				<input id="finishedNoteInput" name="note" type="text" />
			</div>
			<button class="auth-submit" type="submit">Save</button>
		</form>
	</div>
</dialog>

<dialog
	bind:this={noteDialogEl}
	class="settings-modal"
	onclose={() => (noteModalOpen = false)}
	onclick={closeNoteModalOnBackdrop}
>
	<div class="settings-modal__header">
		<h2>Add a note</h2>
		<button
			type="button"
			class="settings-modal__close"
			aria-label="Close"
			onclick={() => (noteModalOpen = false)}
		>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		<form
			method="POST"
			action="?/addNote"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					noteModalOpen = false;
				};
			}}
		>
			<div class="auth-field">
				<label for="noteInput">Note</label>
				<input id="noteInput" name="note" type="text" required />
			</div>
			<button class="auth-submit" type="submit">Save</button>
		</form>
	</div>
</dialog>
