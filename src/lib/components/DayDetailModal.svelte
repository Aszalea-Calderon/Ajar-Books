<script lang="ts">
	import { trapFocus } from '$lib/trapFocus';

	let {
		open,
		onClose,
		date,
		entries
	}: {
		open: boolean;
		onClose: () => void;
		date: string | null;
		entries: {
			bookTitle: string;
			pagesRead: number | null;
			minutesRead: number | null;
			note: string | null;
		}[];
	} = $props();

	let dialogEl: HTMLDialogElement;

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialogEl) onClose();
	}

	function formatHeading(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	let heading = $derived(date ? formatHeading(date) : '');
</script>

<dialog
	bind:this={dialogEl}
	class="settings-modal"
	onclose={onClose}
	onclick={closeOnBackdrop}
	use:trapFocus
>
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
	</div>
</dialog>
