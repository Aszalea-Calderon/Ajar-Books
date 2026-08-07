<script lang="ts">
	import { enhance } from '$app/forms';
	import { trapFocus } from '$lib/trapFocus';

	let {
		open,
		onClose,
		action
	}: {
		open: boolean;
		onClose: () => void;
		action: string;
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
</script>

<dialog
	bind:this={dialogEl}
	class="settings-modal"
	onclose={onClose}
	onclick={closeOnBackdrop}
	use:trapFocus
>
	<div class="settings-modal__header">
		<h2>Set a reading goal</h2>
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
			<div class="auth-field">
				<label for="period">Timeframe</label>
				<select id="period" name="period" required>
					<option value="week">This week</option>
					<option value="month">This month</option>
					<option value="year">This year</option>
				</select>
			</div>
			<div class="auth-field">
				<label for="metric">Track by</label>
				<select id="metric" name="metric" required>
					<option value="books">Books finished</option>
					<option value="pages">Pages read</option>
					<option value="minutes">Minutes listened</option>
				</select>
			</div>
			<div class="auth-field">
				<label for="target">Target</label>
				<input id="target" name="target" type="number" min="1" required />
			</div>
			<button class="auth-submit" type="submit">Set goal</button>
		</form>
	</div>
</dialog>
