<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		open,
		onClose,
		action,
		format,
		totalPages,
		totalMinutes,
		currentPages,
		currentMinutes
	}: {
		open: boolean;
		onClose: () => void;
		action: string;
		format: 'physical' | 'ebook' | 'audiobook' | null;
		totalPages: number | null;
		totalMinutes: number | null;
		currentPages: number;
		currentMinutes: number;
	} = $props();

	let dialogEl: HTMLDialogElement;

	// Resets to 'amount' each time the modal opens rather than persisting,
	// so a past choice doesn't surprise a later visit.
	let logProgressUnit = $state<'amount' | 'percent'>('amount');

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			logProgressUnit = 'amount';
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialogEl) onClose();
	}

	let isAudiobook = $derived(format === 'audiobook');
	let heading = $derived(isAudiobook ? 'Log listening' : 'Log progress');
	let currentPercent = $derived.by(() => {
		const total = isAudiobook ? totalMinutes : totalPages;
		const current = isAudiobook ? currentMinutes : currentPages;
		return total ? Math.round((current / total) * 100) : 0;
	});
</script>

<dialog bind:this={dialogEl} class="settings-modal" onclose={onClose} onclick={closeOnBackdrop}>
	<div class="settings-modal__header">
		<h2>{heading}</h2>
		<button type="button" class="settings-modal__close" aria-label="Close" onclick={onClose}>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		<form
			method="POST"
			{action}
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					onClose();
				};
			}}
		>
			{#if isAudiobook ? totalMinutes : totalPages}
				<div
					class="view-toggle log-progress__unit-toggle"
					role="group"
					aria-label="Log progress as"
				>
					<button
						type="button"
						class="view-toggle__option"
						class:view-toggle__option--active={logProgressUnit === 'amount'}
						onclick={() => (logProgressUnit = 'amount')}
					>
						{isAudiobook ? 'Time' : 'Pages'}
					</button>
					<button
						type="button"
						class="view-toggle__option"
						class:view-toggle__option--active={logProgressUnit === 'percent'}
						onclick={() => (logProgressUnit = 'percent')}
					>
						%
					</button>
				</div>
			{/if}
			{#if logProgressUnit === 'percent'}
				<p class="settings-hint">You're at {currentPercent}%.</p>
				<div class="auth-field">
					<label for="currentPercent">What percent are you done?</label>
					<input
						id="currentPercent"
						name="currentPercent"
						type="number"
						min="0"
						max="100"
						value={currentPercent}
						required
					/>
				</div>
			{:else if isAudiobook}
				<p class="settings-hint">
					You left off at {Math.floor(currentMinutes / 60)}h {currentMinutes % 60}m.
				</p>
				<div class="log-progress__time-fields">
					<div class="auth-field">
						<label for="hoursListened">Hours</label>
						<input
							id="hoursListened"
							name="hours"
							type="number"
							min="0"
							value={Math.floor(currentMinutes / 60)}
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
							value={currentMinutes % 60}
							required
						/>
					</div>
				</div>
			{:else}
				<p class="settings-hint">You left off on page {currentPages}.</p>
				<div class="auth-field">
					<label for="currentPage">What page are you on?</label>
					<input
						id="currentPage"
						name="currentPage"
						type="number"
						min="1"
						value={currentPages || ''}
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
