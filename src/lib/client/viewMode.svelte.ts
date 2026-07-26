export type ViewMode = 'cards' | 'list';

const STORAGE_KEY = 'ajar-view-mode';

export const viewModeState = $state<{ current: ViewMode }>({ current: 'cards' });

export function setViewMode(next: ViewMode) {
	viewModeState.current = next;
	localStorage.setItem(STORAGE_KEY, next);
}

export function initViewMode() {
	const stored = localStorage.getItem(STORAGE_KEY);
	viewModeState.current = stored === 'list' ? 'list' : 'cards';
}
