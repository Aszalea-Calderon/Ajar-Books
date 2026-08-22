<script lang="ts">
	import { enhance } from '$app/forms';
	import { todayLocalDateString } from '$lib/date';
	import { trapFocus } from '$lib/trapFocus';
	import { dialogModal } from '$lib/dialogModal';

	let {
		open,
		action,
		heading,
		submitLabel,
		currentFormat,
		currentTotalPages,
		currentTotalMinutes,
		suggestedPageCount,
		showStartDate = false,
		onClose
	}: {
		open: boolean;
		action: string;
		heading: string;
		submitLabel: string;
		currentFormat: 'physical' | 'ebook' | 'audiobook' | null;
		currentTotalPages: number | null;
		currentTotalMinutes: number | null;
		suggestedPageCount: number | null;
		showStartDate?: boolean;
		onClose: () => void;
	} = $props();

	const formats = ['physical', 'ebook', 'audiobook'] as const;
	type Format = (typeof formats)[number];
	const formatLabels: Record<Format, string> = {
		physical: 'Physical',
		ebook: 'Ebook',
		audiobook: 'Audiobook'
	};

	let selectedFormat = $state<Format>('physical');
	let startDate = $state('');

	function resetOnOpen() {
		selectedFormat = currentFormat ?? 'physical';
		startDate = todayLocalDateString();
	}

	// Suggest the pulled-in page count only for a fresh (not previously saved)
	// physical/ebook pick — there's no equivalent source for audiobook runtime.
	let totalDefault = $derived.by(() => {
		if (selectedFormat === currentFormat) {
			return selectedFormat === 'audiobook' ? currentTotalMinutes : currentTotalPages;
		}
		if (selectedFormat !== 'audiobook') return suggestedPageCount;
		return null;
	});

	// Audiobook length is edited as hours/minutes (how a reader actually
	// thinks about it) rather than a raw minute count, storing/submitting
	// totalMinutes underneath for precision. Re-syncs from totalDefault
	// whenever the format/modal changes, same as startDate above.
	let audiobookHours = $state(0);
	let audiobookMinutes = $state(0);

	$effect(() => {
		const total = totalDefault ?? 0;
		audiobookHours = Math.floor(total / 60);
		audiobookMinutes = total % 60;
	});

	let audiobookTotalMinutes = $derived(audiobookHours * 60 + audiobookMinutes);
</script>

<dialog
	class="settings-modal"
	onclose={onClose}
	use:dialogModal={{ open, onClose, onOpen: resetOnOpen }}
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
			<div class="format-toggle">
				{#each formats as f (f)}
					<button
						type="button"
						class="format-toggle__pill"
						class:format-toggle__pill--active={selectedFormat === f}
						onclick={() => (selectedFormat = f)}
					>
						{formatLabels[f]}
					</button>
				{/each}
			</div>
			<input type="hidden" name="format" value={selectedFormat} />
			{#if showStartDate}
				<div class="auth-field">
					<label for="formatModalStartDate">Date started</label>
					<input
						id="formatModalStartDate"
						name="startedAt"
						type="date"
						max={todayLocalDateString()}
						bind:value={startDate}
					/>
				</div>
				<!-- No editable total here — the pulled-in page count (if any) is
				     submitted as-is. Adjusting the goal later happens via "Change
				     format", which does show an editable field. -->
				<input
					type="hidden"
					name={selectedFormat === 'audiobook' ? 'totalMinutes' : 'totalPages'}
					value={totalDefault}
				/>
			{:else if selectedFormat === 'audiobook'}
				<p class="format-modal__field-label">Total length</p>
				<div class="log-progress__time-fields">
					<div class="auth-field">
						<label for="formatModalHours">Hours</label>
						<input id="formatModalHours" type="number" min="0" bind:value={audiobookHours} />
					</div>
					<div class="auth-field">
						<label for="formatModalMinutes">Minutes</label>
						<input
							id="formatModalMinutes"
							type="number"
							min="0"
							max="59"
							bind:value={audiobookMinutes}
						/>
					</div>
				</div>
				<input type="hidden" name="totalMinutes" value={audiobookTotalMinutes} />
			{:else}
				<div class="auth-field">
					<label for="formatModalTotal">Total pages</label>
					<input
						id="formatModalTotal"
						name="totalPages"
						type="number"
						min="1"
						value={totalDefault}
					/>
				</div>
			{/if}
			<button class="auth-submit" type="submit">{submitLabel}</button>
		</form>
	</div>
</dialog>
