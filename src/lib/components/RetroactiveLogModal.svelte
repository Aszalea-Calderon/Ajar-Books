<script lang="ts">
	import { enhance } from '$app/forms';
	import { trapFocus } from '$lib/trapFocus';
	import { dialogModal } from '$lib/dialogModal';

	let {
		open,
		onClose,
		userBookId,
		bookTitle,
		date,
		format
	}: {
		open: boolean;
		onClose: () => void;
		userBookId: string;
		bookTitle: string;
		date: string;
		format: 'physical' | 'ebook' | 'audiobook' | null;
	} = $props();

	let isAudiobook = $derived(format === 'audiobook');

	// A plain amount ("how much did you read"), not the book detail page's
	// "what page are you on now" framing — this is backfilling a specific
	// past day, so there's no "current position" to ask for, just a delta.
	let formattedDate = $derived.by(() => {
		const [year, month, day] = date.split('-').map(Number);
		return new Date(year, month - 1, day).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	});
</script>

<dialog class="settings-modal" onclose={onClose} use:dialogModal={{ open, onClose }} use:trapFocus>
	<div class="settings-modal__header">
		<h2>{isAudiobook ? 'Log listening' : 'Log reading'}</h2>
		<button type="button" class="settings-modal__close" aria-label="Close" onclick={onClose}>
			×
		</button>
	</div>
	<div class="settings-modal__content">
		<p class="settings-hint">{bookTitle} — {formattedDate}</p>
		<form
			method="POST"
			action="?/logForDate"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					onClose();
				};
			}}
		>
			<input type="hidden" name="userBookId" value={userBookId} />
			<input type="hidden" name="date" value={date} />
			{#if isAudiobook}
				<div class="log-progress__time-fields">
					<div class="auth-field">
						<label for="retroHours">Hours</label>
						<input id="retroHours" name="hours" type="number" min="0" value="0" required />
					</div>
					<div class="auth-field">
						<label for="retroMinutes">Minutes</label>
						<input
							id="retroMinutes"
							name="minutes"
							type="number"
							min="0"
							max="59"
							value="0"
							required
						/>
					</div>
				</div>
			{:else}
				<div class="auth-field">
					<label for="retroPages">Pages read</label>
					<input id="retroPages" name="pages" type="number" min="1" required />
				</div>
			{/if}
			<div class="auth-field">
				<label for="retroNote">Note (optional)</label>
				<input id="retroNote" name="note" type="text" />
			</div>
			<button class="auth-submit" type="submit">Log</button>
		</form>
	</div>
</dialog>
