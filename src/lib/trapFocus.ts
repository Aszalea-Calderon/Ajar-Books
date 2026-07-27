const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Native <dialog>+showModal() makes the rest of the page inert, but doesn't
 * reliably wrap Tab from the last focusable element back to the first (or
 * Shift+Tab from the first back to the last) — confirmed via Playwright:
 * focus can escape to <body> while the dialog stays open, effectively
 * breaking the modal's focus trap. This action wraps focus manually within
 * the element's own focusable children.
 */
export function trapFocus(node: HTMLElement) {
	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
			(el) => el.offsetParent !== null
		);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown);
	return {
		destroy() {
			node.removeEventListener('keydown', handleKeydown);
		}
	};
}
