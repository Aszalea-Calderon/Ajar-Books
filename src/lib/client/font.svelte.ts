// Same override-a-data-attribute pattern as theme/backgroundTexture — see
// app.css's [data-font='...'] selectors for the actual --font-body swaps,
// and +layout.svelte for where each font's CSS files get imported.
export type Font = 'default' | 'dyslexic' | 'inter' | 'atkinson' | 'merriweather' | 'lora' | 'nunito';

const VALID_FONTS: Font[] = ['default', 'dyslexic', 'inter', 'atkinson', 'merriweather', 'lora', 'nunito'];

const STORAGE_KEY = 'ajar-font';

export const fontState = $state<{ current: Font }>({ current: 'default' });

export function setFont(next: Font) {
	fontState.current = next;
	if (next === 'default') {
		delete document.documentElement.dataset.font;
	} else {
		document.documentElement.dataset.font = next;
	}
	localStorage.setItem(STORAGE_KEY, next);
}

export function initFont() {
	const stored = localStorage.getItem(STORAGE_KEY) as Font | null;
	fontState.current = stored && VALID_FONTS.includes(stored) ? stored : 'default';
}
