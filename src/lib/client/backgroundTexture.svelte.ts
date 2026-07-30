export type BackgroundTexture = 'dotted' | 'none';

const STORAGE_KEY = 'ajar-bg-texture';

export const backgroundTextureState = $state<{ current: BackgroundTexture }>({ current: 'dotted' });

export function setBackgroundTexture(next: BackgroundTexture) {
	backgroundTextureState.current = next;
	if (next === 'dotted') {
		delete document.documentElement.dataset.bgTexture;
	} else {
		document.documentElement.dataset.bgTexture = next;
	}
	localStorage.setItem(STORAGE_KEY, next);
}

export function initBackgroundTexture() {
	const stored = localStorage.getItem(STORAGE_KEY);
	backgroundTextureState.current = stored === 'none' ? 'none' : 'dotted';
	if (stored === 'none') document.documentElement.dataset.bgTexture = 'none';
}
