/**
 * Calls `callback` on any click outside `node`. Attach to the container that
 * wraps BOTH a dropdown's trigger button and its menu, not just the menu
 * itself — otherwise a click on the trigger (which toggles the menu open or
 * closed on its own) would also count as "outside" and fight with it.
 */
export function clickOutside(node: HTMLElement, callback: () => void) {
	function handleClick(event: MouseEvent) {
		if (!node.contains(event.target as Node)) {
			callback();
		}
	}

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
}
