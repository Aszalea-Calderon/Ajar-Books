export type ViewMode = 'cards' | 'list' | 'table' | 'shelf';
export type ViewScope = 'search' | 'profile';

// Search shows remote/unowned results (no shelf makes sense there); My
// Library owns real books, so it's the only scope that offers Shelf.
const ALLOWED_MODES: Record<ViewScope, ViewMode[]> = {
	search: ['cards', 'list', 'table'],
	profile: ['cards', 'list', 'table', 'shelf']
};

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
		const allowed = ALLOWED_MODES[scope];
		state.current = allowed.includes(stored as ViewMode) ? (stored as ViewMode) : 'cards';
	}

	return { state, set, init };
}

export const searchViewMode = createViewModeStore('search');
export const profileViewMode = createViewModeStore('profile');
