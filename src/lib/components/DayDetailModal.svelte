<script lang="ts">
	import { trapFocus } from '$lib/trapFocus';
	import { dialogModal } from '$lib/dialogModal';

	let {
		open,
		onClose,
		date,
		today,
		entries,
		onLogClick
	}: {
		open: boolean;
		onClose: () => void;
		date: string | null;
		today: string;
		entries: {
			bookTitle: string;
			pagesRead: number | null;
			minutesRead: number | null;
			note: string | null;
		}[];
		onLogClick: () => void;
	} = $props();

	function formatHeading(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	let heading = $derived(date ? formatHeading(date) : '');
	// Same YYYY-MM-DD zero-padded shape as `today`, so lexicographic
	// comparison is chronological — no logging for a day that hasn't
	// happened yet.
	let canLog = $derived(date !== null && date <= today);
</script>

<dialog class="settings-modal" onclose={onClose} use:dialogModal={{ open, onClose }} use:trapFocus>
	<div class="settings-modal__header">
		<h2>{heading}</h2>
		<button type="button" class="settings-modal__close" aria-label="Close" onclick={onClose}>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		{#if entries.length === 0}
			<p class="settings-hint">Nothing logged this day.</p>
		{:else}
			<ul class="day-detail-modal__list">
				{#each entries as entry, i (i)}
					<li class="day-detail-modal__entry">
						<div class="day-detail-modal__row">
							<span class="day-detail-modal__title">{entry.bookTitle}</span>
							<span class="day-detail-modal__amount">
								{#if entry.pagesRead}{entry.pagesRead} pages{/if}
								{#if entry.minutesRead}{entry.minutesRead} minutes{/if}
							</span>
						</div>
						{#if entry.note}
							<p class="day-detail-modal__note">{entry.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if canLog}
			<div class="day-detail-modal__footer">
				<button type="button" class="settings-trigger" onclick={onLogClick}>
					+ Log for this day
				</button>
			</div>
		{/if}
	</div>
</dialog>
