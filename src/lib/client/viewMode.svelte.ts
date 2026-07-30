export type ViewMode = 'cards' | 'list' | 'table';
export type ViewScope = 'search' | 'profile';

const VALID_MODES: ViewMode[] = ['cards', 'list', 'table'];

function storageKey(scope: ViewScope) {
	return `ajar-view-mode-${scope}`;
}

// Search and My Library each get their own persisted view-mode preference —
// someone might want one dense (table) and the other visual (cards).
// Editable both in-page (ViewButton) and ahead of time in Settings; there's
// no separate "default" concept, just the one persisted value per scope.
function createViewModeStore(scope: ViewScope) {
	const state = $state<{ current: ViewMode }>({ current: 'cards' });

	function set(next: ViewMode) {
		state.current = next;
		localStorage.setItem(storageKey(scope), next);
	}

	function init() {
		const stored = localStorage.getItem(storageKey(scope));
		state.current = VALID_MODES.includes(stored as ViewMode) ? (stored as ViewMode) : 'cards';
	}

	return { state, set, init };
}

export const searchViewMode = createViewModeStore('search');
export const profileViewMode = createViewModeStore('profile');
