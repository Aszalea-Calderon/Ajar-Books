import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
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
	status: text('status', { enum: ['want_to_read', 'reading', 'finished', 'dnf'] })
		.notNull()
		.default('want_to_read'),
	format: text('format', { enum: ['physical', 'ebook', 'audiobook'] }),
	totalPages: integer('total_pages'),
	totalMinutes: integer('total_minutes'),
	rating: real('rating'),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	finishedAt: integer('finished_at', { mode: 'timestamp' }),
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
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

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
