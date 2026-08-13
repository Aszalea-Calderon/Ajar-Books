<script lang="ts">
	import { trapFocus } from '$lib/trapFocus';

	let {
		open,
		message,
		confirmLabel = 'Confirm',
		danger = true,
		confirmText,
		onConfirm,
		onCancel
	}: {
		open: boolean;
		message: string;
		confirmLabel?: string;
		danger?: boolean;
		// When set, the Confirm button stays disabled until the user types
		// this exact string — for actions where a single click (even behind
		// a "are you sure" message) is too easy to hit by accident.
		confirmText?: string;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let dialogEl: HTMLDialogElement;
	let typedText = $state('');
	let canConfirm = $derived(!confirmText || typedText === confirmText);

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) {
			typedText = '';
			dialogEl.showModal();
		} else if (!open && dialogEl.open) {
			dialogEl.close();
		}
	});

	function closeOnBackdrop(event: MouseEvent) {
		if (event.target === dialogEl) onCancel();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm-modal"
	onclose={onCancel}
	onclick={closeOnBackdrop}
	use:trapFocus
>
	<p class="confirm-modal__message">{message}</p>
	{#if confirmText}
		<label class="confirm-modal__typed-label">
			Type <strong>{confirmText}</strong> to confirm
			<input
				class="confirm-modal__typed-input"
				type="text"
				autocomplete="off"
				bind:value={typedText}
			/>
		</label>
	{/if}
	<div class="confirm-modal__actions">
		<button type="button" class="confirm-modal__cancel" onclick={onCancel}>Cancel</button>
		<button
			type="button"
			class="confirm-modal__confirm"
			class:confirm-modal__confirm--danger={danger}
			disabled={!canConfirm}
			onclick={onConfirm}
		>
			{confirmLabel}
		</button>
	</div>
</dialog>
