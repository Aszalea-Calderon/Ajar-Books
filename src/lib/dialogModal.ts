/**
 * Syncs a native <dialog>'s open/closed state with an `open` boolean prop
 * (calling showModal()/close() as needed, since neither has a declarative
 * attribute equivalent) and wires backdrop-click-to-close — the handful of
 * lines every modal in this app was hand-rolling identically. `onOpen`, if
 * given, runs right before showModal() each time the dialog opens — for a
 * modal that needs to reset its own local state (e.g. LogProgressModal's
 * unit toggle) rather than persist it across visits.
 */
export function dialogModal(
	node: HTMLDialogElement,
	params: { open: boolean; onClose: () => void; onOpen?: () => void }
) {
	function sync() {
		if (params.open && !node.open) {
			params.onOpen?.();
			node.showModal();
		} else if (!params.open && node.open) {
			node.close();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === node) params.onClose();
	}

	node.addEventListener('click', handleBackdropClick);
	sync();

	return {
		update(newParams: typeof params) {
			params = newParams;
			sync();
		},
		destroy() {
			node.removeEventListener('click', handleBackdropClick);
		}
	};
}
