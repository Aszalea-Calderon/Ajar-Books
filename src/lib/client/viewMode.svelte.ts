export type ViewMode = 'cards' | 'list' | 'table' | 'shelf';
export type ViewScope = 'search' | 'profile' | 'insights';

// Search shows remote/unowned results (no shelf makes sense there); My
// Library and Insights' drill-down panel both own real books, so those are
// the scopes that offer Shelf.
const ALLOWED_MODES: Record<ViewScope, ViewMode[]> = {
	search: ['cards', 'list', 'table'],
	profile: ['cards', 'list', 'table', 'shelf'],
	insights: ['cards', 'list', 'table', 'shelf']
};

function storageKey(scope: ViewScope) {
	return `ajar-view-mode-${scope}`;
}

// Search, My Library, and Insights each get their own persisted view-mode
// preference — someone might want one dense (table) and another visual
// (cards). Editable both in-page (ViewButton) and ahead of time in Settings;
// there's no separate "default" concept beyond the per-scope fallback below,
// just the one persisted value per scope.
function createViewModeStore(scope: ViewScope, defaultMode: ViewMode = 'cards') {
	const state = $state<{ current: ViewMode }>({ current: defaultMode });

	function set(next: ViewMode) {
		state.current = next;
		localStorage.setItem(storageKey(scope), next);
	}

	function init() {
		const stored = localStorage.getItem(storageKey(scope));
		const allowed = ALLOWED_MODES[scope];
		state.current = allowed.includes(stored as ViewMode) ? (stored as ViewMode) : defaultMode;
	}

	return { state, set, init };
}

export const searchViewMode = createViewModeStore('search');
export const profileViewMode = createViewModeStore('profile');
// Defaults to 'shelf', not 'cards' — the 3D shelf is the drill-down panel's
// original, purpose-built display; Cards/List/Table are additional options
// layered on afterward, not a replacement for what's already there.
export const insightsViewMode = createViewModeStore('insights', 'shelf');
