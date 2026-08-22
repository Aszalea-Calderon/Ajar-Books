<script lang="ts">
	import { enhance } from '$app/forms';
	import { trapFocus } from '$lib/trapFocus';
	import { dialogModal } from '$lib/dialogModal';

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

	// Resets to 'amount' each time the modal opens rather than persisting,
	// so a past choice doesn't surprise a later visit.
	let logProgressUnit = $state<'amount' | 'percent'>('amount');

	let isAudiobook = $derived(format === 'audiobook');
	let heading = $derived(isAudiobook ? 'Log listening' : 'Log progress');
	let currentPercent = $derived.by(() => {
		const total = isAudiobook ? totalMinutes : totalPages;
		const current = isAudiobook ? currentMinutes : currentPages;
		return total ? Math.round((current / total) * 100) : 0;
	});
</script>

<dialog
	class="settings-modal"
	onclose={onClose}
	use:dialogModal={{ open, onClose, onOpen: () => (logProgressUnit = 'amount') }}
	use:trapFocus
>
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
					class="status-control log-progress__unit-toggle"
					role="group"
					aria-label="Log progress as"
				>
					<button
						type="button"
						class="status-control__pill"
						class:status-control__pill--active={logProgressUnit === 'amount'}
						onclick={() => (logProgressUnit = 'amount')}
					>
						{isAudiobook ? 'Time' : 'Pages'}
					</button>
					<button
						type="button"
						class="status-control__pill"
						class:status-control__pill--active={logProgressUnit === 'percent'}
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
