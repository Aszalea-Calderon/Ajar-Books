import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	// A randomly-generated recovery key, hashed the same way as the password
	// (never stored in plaintext) — null until one's generated in Settings.
	// Single-use: cleared the moment it's used to reset a password, so a
	// leaked-and-used key can't be replayed; Settings prompts to generate a
	// fresh one once it's gone.
	recoveryKeyHash: text('recovery_key_hash'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const books = sqliteTable('books', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	author: text('author'),
	coverUrl: text('cover_url'),
	openLibraryId: text('open_library_id').unique(),
	isbn: text('isbn'),
	description: text('description'),
	pageCount: integer('page_count'),
	publicationYear: integer('publication_year'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const userBooks = sqliteTable('user_books', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	bookId: text('book_id')
		.notNull()
		.references(() => books.id, { onDelete: 'cascade' }),
	// 'added' is a transient, one-way-exit-only marker meaning "in the library,
	// but no status has been chosen yet" — never a manually re-selectable
	// target once left (see setStatus's validStatuses, which excludes it).
	status: text('status', { enum: ['added', 'want_to_read', 'reading', 'finished', 'dnf'] })
		.notNull()
		.default('added'),
	format: text('format', { enum: ['physical', 'ebook', 'audiobook'] }),
	totalPages: integer('total_pages'),
	totalMinutes: integer('total_minutes'),
	rating: real('rating'),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
	// finishedAt only ever holds the most recent completion — this counts every
	// genuine transition into 'finished', so a reread's full history isn't
	// lost the way a single timestamp would lose it.
	timesFinished: integer('times_finished').notNull().default(0),
	// A deliberate manual choice, not a rating threshold — most naturally set
	// from the "Finished" flow, but can be toggled later from the book detail
	// page for books finished before this existed.
	isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * Single-row app-wide config editable from Settings (e.g. API keys) —
 * a DB-backed alternative to env vars that doesn't require a restart.
 * Always keyed by SETTINGS_ID ('app'); see $lib/server/settings.ts.
 */
export const settings = sqliteTable('settings', {
	id: text('id').primaryKey(),
	googleBooksApiKey: text('google_books_api_key'),
	// ISO 639-1 code (e.g. 'en'). Search results whose edition/work matches
	// this language are ranked above ones that don't — see
	// $lib/server/books/search.ts's LANGUAGE_PRIORITY_OPTIONS.
	languagePriority: text('language_priority').notNull().default('en'),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

/**
 * A tag's `name` is only unique within its `type` — "Historical" can exist
 * as both a genre and a mood without colliding.
 */
export const tags = sqliteTable(
	'tags',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		type: text('type', { enum: ['genre', 'mood', 'setting'] }).notNull(),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [unique().on(table.type, table.name)]
);

export const userBookTags = sqliteTable(
	'user_book_tags',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userBookId: text('user_book_id')
			.notNull()
			.references(() => userBooks.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(table) => [unique().on(table.userBookId, table.tagId)]
);

export const readingLogs = sqliteTable('reading_logs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userBookId: text('user_book_id')
		.notNull()
		.references(() => userBooks.id, { onDelete: 'cascade' }),
	pagesRead: integer('pages_read'),
	minutesRead: integer('minutes_read'),
	note: text('note'),
	loggedAt: integer('logged_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const goals = sqliteTable('goals', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	period: text('period', { enum: ['week', 'month', 'year'] }).notNull(),
	metric: text('metric', { enum: ['books', 'pages', 'minutes'] }).notNull(),
	target: integer('target').notNull(),
	// Computed once at creation time from `period` + that day's date
	// (Monday-start week / calendar month / calendar year) — not a
	// user-picked range. A goal is scoped to that one period instance and
	// doesn't roll forward once its window closes.
	periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
	periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Server-driven so the import survives a closed tab or a page navigation —
// the old client-driven batch loop lost all progress the moment the browser
// tab went away (confirmed: a real 397-row import lost to a laptop sleep,
// 2026-08-09). `rows` holds every parsed+mapped row up front so the server
// can keep working through them on its own; `results` accumulates as each
// one completes. Single-tenant app, so there's realistically ever at most
// one active row at a time, but nothing here assumes that structurally.
export const importJobs = sqliteTable('import_jobs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	// Who to notify on completion — see notifications.ts. Nothing in this
	// table's own logic branches on it; it exists purely as the addressee
	// for the "import finished" notification fired when a job reaches 'done'.
	// Nullable only so `ALTER TABLE ADD COLUMN` doesn't choke on rows that
	// already existed in a dev/prod database before this column was added
	// (SQLite requires a default for a NOT NULL column added this way); every
	// job created going forward always sets it.
	userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
	status: text('status', {
		enum: ['running', 'stopping', 'done', 'stopped', 'error']
	})
		.notNull()
		.default('running'),
	rows: text('rows', { mode: 'json' }).notNull(),
	total: integer('total').notNull(),
	processed: integer('processed').notNull().default(0),
	results: text('results', { mode: 'json' }).notNull().default('[]'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// A saved snapshot of every Display knob (Settings > Display) under one
// name, so a user can switch between multiple looks instead of only ever
// tweaking the one live state — see cardStyle.svelte.ts/accent.svelte.ts/etc.
// for the live client-side state this is a named snapshot of. Applying one
// is purely client-side (no server round trip beyond loading this list);
// this table exists so the saved set is available account-wide rather than
// stuck in one browser's localStorage.
export const customThemes = sqliteTable(
	'custom_themes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		theme: text('theme', { enum: ['dark', 'light'] }).notNull(),
		accentColor: text('accent_color'),
		backgroundTexture: text('background_texture', { enum: ['dotted', 'none'] }).notNull(),
		font: text('font', { enum: ['default', 'dyslexic'] }).notNull(),
		cardRadiusScale: real('card_radius_scale').notNull(),
		cardOpacity: real('card_opacity').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [unique().on(table.name)]
);

// Async/background events worth surfacing persistently instead of a
// one-off banner that's only visible if you happen to be looking at the
// right page when it happens — import finishing while you're elsewhere in
// the app is the motivating case (see job.ts's runJob). Password reset and
// backfill also post here even though their own flows already show an
// inline result, so there's still a durable record if you weren't looking
// at that screen (e.g. the /recover flow — you're not even logged in yet).
export const notifications = sqliteTable('notifications', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	type: text('type', {
		enum: ['import_finished', 'password_reset', 'backfill_complete']
	}).notNull(),
	message: text('message').notNull(),
	readAt: integer('read_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
