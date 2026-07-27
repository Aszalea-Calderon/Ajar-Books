<script lang="ts">
	import { trapFocus } from '$lib/trapFocus';

	let {
		open,
		message,
		confirmLabel = 'Confirm',
		danger = true,
		onConfirm,
		onCancel
	}: {
		open: boolean;
		message: string;
		confirmLabel?: string;
		danger?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let dialogEl: HTMLDialogElement;

	$effect(() => {
		if (!dialogEl) return;
		if (open && !dialogEl.open) dialogEl.showModal();
		else if (!open && dialogEl.open) dialogEl.close();
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
	<div class="confirm-modal__actions">
		<button type="button" class="confirm-modal__cancel" onclick={onCancel}>Cancel</button>
		<button
			type="button"
			class="confirm-modal__confirm"
			class:confirm-modal__confirm--danger={danger}
			onclick={onConfirm}
		>
			{confirmLabel}
		</button>
	</div>
</dialog>
