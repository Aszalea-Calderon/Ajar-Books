import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Vite's dev-mode SSR module invalidation can re-execute this module's
// top-level side effects — opening a fresh `better-sqlite3` connection and
// re-running `migrate()` — on requests after unrelated server-file edits,
// without ever closing the previous connection. `globalThis` survives
// module re-evaluation the way this module's own top-level scope doesn't,
// so caching the instance there guarantees exactly one connection and one
// migration run per real process lifetime — in dev or prod.
const globalForDb = globalThis as typeof globalThis & { __ajarDb?: Db };

function createDb(): Db {
	const client = new Database(env.DATABASE_URL);
	// Deliberately NOT WAL mode. WAL requires every connection touching this
	// file to correctly coordinate through a shared -shm index, and that
	// coordination is what actually caused five separate real data-loss/
	// corruption incidents in one session (see docs/adr/0002) — across a
	// Docker+host boundary, a raw seed script, a leaked dev-mode connection,
	// a container restart mid-checkpoint, and (even after the leak above was
	// fixed) still once more with only a single leaked connection involved.
	// This app is single-user with no real concurrent-write workload, so
	// WAL's main benefit (readers not blocking a writer) buys nothing here.
	// The default rollback-journal mode has none of that shared-memory
	// coordination to get wrong — every incident's common thread, gone.
	// Explicit, not just omitted: journal mode is stored in the database
	// file itself, so an existing file from before this change is still in
	// WAL mode until something actually converts it back. Wrapped in
	// try/catch because an in-memory database (vitest's `:memory:`) has no
	// file to journal in the first place and can reject a file-backed
	// journal mode outright — harmless to skip there, since the WAL
	// cross-connection coordination this is guarding against is a
	// file-on-disk problem that doesn't exist for `:memory:` regardless.
	try {
		client.pragma('journal_mode = DELETE');
	} catch {
		// no-op — see above
	}
	// SQLite ignores ON DELETE CASCADE (defined in the schema/migrations) unless
	// foreign key enforcement is turned on for the connection.
	client.pragma('foreign_keys = ON');

	const instance = drizzle(client, { schema });

	// Applies any pending SQL migrations on startup so a fresh `docker compose up`
	// ends with an up-to-date schema without a separate migrate step.
	migrate(instance, { migrationsFolder: 'drizzle' });

	return instance;
}

export const db = globalForDb.__ajarDb ?? (globalForDb.__ajarDb = createDb());
