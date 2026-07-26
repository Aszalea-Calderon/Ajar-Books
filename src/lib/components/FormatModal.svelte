<script lang="ts">
	import { enhance } from '$app/forms';

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

	function todayLocalDateString(): string {
		const now = new Date();
		const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 10);
	}

	let selectedFormat = $state<Format>('physical');
	let startDate = $state('');
	let dialogEl: HTMLDialogElement;

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			selectedFormat = currentFormat ?? 'physical';
			startDate = todayLocalDateString();
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialogEl) onClose();
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
			{/if}
			<div class="auth-field">
				<label for="formatModalTotal">
					{selectedFormat === 'audiobook' ? 'Total length (minutes)' : 'Total pages'}
				</label>
				<input
					id="formatModalTotal"
					name={selectedFormat === 'audiobook' ? 'totalMinutes' : 'totalPages'}
					type="number"
					min="1"
					value={totalDefault}
				/>
			</div>
			<button class="auth-submit" type="submit">{submitLabel}</button>
		</form>
	</div>
</dialog>
