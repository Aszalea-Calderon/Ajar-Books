// Generic placeholder covers for books with no real cover art — a real gap,
// not a hypothetical one: 399 of 446 imported books (89%) have none. Instead
// of one flat empty box everywhere, each book gets a color deterministically
// picked from a small curated palette (so the same book always renders the
// same variant, and a shelf of them reads as varied rather than monotonous)
// plus its own title, rendered as an inline SVG data URI — no image assets
// to store or fetch, and it drops straight into any existing `<img src>`.

type Palette = { bg: string; text: string };

// Muted jewel tones, not primary-color garish — chosen so near-white text
// stays comfortably legible on all eight (each pair well past WCAG AA for
// this size of text) regardless of the app's own light/dark theme, since
// this is a static image rendered the same either way.
const PALETTES: Palette[] = [
	{ bg: '#2D5D7B', text: '#F4F6F5' },
	{ bg: '#8B4049', text: '#F7ECE9' },
	{ bg: '#4A6741', text: '#EFF3EA' },
	{ bg: '#6B4E8E', text: '#F3EEF7' },
	{ bg: '#B36A2E', text: '#FBF1E6' },
	{ bg: '#35707A', text: '#EAF3F3' },
	{ bg: '#7A5138', text: '#F5EEE7' },
	{ bg: '#4E5D94', text: '#EEF0F7' }
];

function hashSeed(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

function paletteFor(seed: string): Palette {
	return PALETTES[hashSeed(seed) % PALETTES.length];
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

const MAX_LINES = 5;
const CHARS_PER_LINE = 16;

/** Greedy word-wrap sized for a ~200-unit-wide cover at the font size below. */
function wrapTitle(title: string): string[] {
	const words = title.trim().split(/\s+/);
	const lines: string[] = [];
	let current = '';

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > CHARS_PER_LINE && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
		if (lines.length === MAX_LINES) break;
	}
	if (lines.length < MAX_LINES && current) lines.push(current);

	if (lines.length === MAX_LINES) {
		const last = lines[MAX_LINES - 1];
		lines[MAX_LINES - 1] = last.length > CHARS_PER_LINE - 1 ? `${last.slice(0, CHARS_PER_LINE - 1)}…` : last;
	}

	return lines;
}

const WIDTH = 200;
const HEIGHT = 300;
const LINE_HEIGHT = 26;
const FONT_SIZE = 20;

function buildSvg(seed: string, title: string | undefined): string {
	const { bg, text } = paletteFor(seed);
	const lines = title ? wrapTitle(title) : [];
	const blockHeight = lines.length * LINE_HEIGHT;
	const startY = (HEIGHT - blockHeight) / 2 + FONT_SIZE * 0.75;

	const textLines = lines
		.map(
			(line, i) =>
				`<text x="${WIDTH / 2}" y="${startY + i * LINE_HEIGHT}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${text}">${escapeXml(line)}</text>`
		)
		.join('');

	// A thin rule above and below the title block — a small nod to a real
	// jacket design rather than a plain color swatch.
	const ruleY1 = startY - FONT_SIZE - 10;
	const ruleY2 = startY + (lines.length - 1) * LINE_HEIGHT + 20;
	const rules =
		lines.length > 0
			? `<line x1="${WIDTH / 2 - 24}" y1="${ruleY1}" x2="${WIDTH / 2 + 24}" y2="${ruleY1}" stroke="${text}" stroke-width="1" opacity="0.6" />` +
				`<line x1="${WIDTH / 2 - 24}" y1="${ruleY2}" x2="${WIDTH / 2 + 24}" y2="${ruleY2}" stroke="${text}" stroke-width="1" opacity="0.6" />`
			: '';

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" />${rules}${textLines}</svg>`;
}

/** A book's own id/isbn/title (see resultKey in search) is a fine seed — this only needs to be stable per book, not globally unique. */
export function placeholderCoverDataUri(seed: string, title?: string): string {
	return `data:image/svg+xml,${encodeURIComponent(buildSvg(seed, title))}`;
}

/** Drop-in replacement for `book.coverUrl` wherever it might be null. */
export function coverSrc(coverUrl: string | null | undefined, seed: string, title?: string): string {
	return coverUrl ?? placeholderCoverDataUri(seed, title);
}
