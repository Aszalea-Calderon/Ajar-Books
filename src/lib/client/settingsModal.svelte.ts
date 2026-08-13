export type SettingsSection = 'themes' | 'fonts' | 'search' | 'integrations' | 'tags' | 'data';

// Lets any page open Settings directly to a specific tab (e.g. the "no
// recovery key" reminder jumping straight to Account Recovery) without
// threading callbacks through the layout — the layout's SettingsModal
// instance just binds to this instead of owning the state itself.
const state = $state<{ open: boolean; section: SettingsSection }>({
	open: false,
	section: 'themes'
});

export const settingsModalState = state;

export function openSettingsTo(section: SettingsSection) {
	state.section = section;
	state.open = true;
}
