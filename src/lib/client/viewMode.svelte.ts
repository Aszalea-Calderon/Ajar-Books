export type ViewMode = 'cards' | 'list' | 'table';

const STORAGE_KEY = 'ajar-view-mode';
const VALID_MODES: ViewMode[] = ['cards', 'list', 'table'];

export const viewModeState = $state<{ current: ViewMode }>({ current: 'cards' });

export function setViewMode(next: ViewMode) {
	viewModeState.current = next;
	localStorage.setItem(STORAGE_KEY, next);
}

export function initViewMode() {
	const stored = localStorage.getItem(STORAGE_KEY);
	viewModeState.current = VALID_MODES.includes(stored as ViewMode) ? (stored as ViewMode) : 'cards';
}
