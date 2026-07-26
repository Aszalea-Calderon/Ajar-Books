// Curated subset of ISO 639-1 codes offered as a language-priority choice in
// Settings — shared between the client (Settings UI) and server (search
// ranking), so it can't live under $lib/server.
export const LANGUAGE_PRIORITY_OPTIONS: { code: string; label: string }[] = [
	{ code: 'en', label: 'English' },
	{ code: 'es', label: 'Spanish' },
	{ code: 'fr', label: 'French' },
	{ code: 'de', label: 'German' },
	{ code: 'it', label: 'Italian' },
	{ code: 'pt', label: 'Portuguese' },
	{ code: 'ja', label: 'Japanese' },
	{ code: 'zh', label: 'Chinese' },
	{ code: 'ru', label: 'Russian' }
];
