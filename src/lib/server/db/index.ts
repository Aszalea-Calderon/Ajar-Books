import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Vitest's own config sets DATABASE_URL=:memory: for test runs, but that's
// a second, independent place declaring the same intent — and it silently
// stopped taking effect at least twice in one real session (2026-08-12/13),
// each time leaving a test fixture's username sitting in the real dev
// local.db in place of the real account. Root cause unconfirmed. Rather
// than trust the config alone a second time, this is a hard, structural
// backstop: Vitest always sets process.env.VITEST, so a test run can never
// end up pointed at a real file no matter what DATABASE_URL resolves to.
const databaseUrl = process.env.VITEST ? ':memory:' : env.DATABASE_URL;

type Db = ReturnType<typeof drizzle<typeof schema>>;
type Cached = { db: Db; client: Database.Database };

// Vite's dev-mode SSR module invalidation can re-execute this module's
// top-level side effects — opening a fresh `better-sqlite3` connection and
// re-running `migrate()` — on requests after unrelated server-file edits,
// without ever closing the previous connection. `globalThis` survives
// module re-evaluation the way this module's own top-level scope doesn't,
// so caching the instance there guarantees exactly one connection and one
// migration run per real process lifetime — in dev or prod.
const globalForDb = globalThis as typeof globalThis & { __ajarDb?: Cached };

function createDb(): Cached {
	const client = new Database(databaseUrl);
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

	return { db: instance, client };
}

const cached = globalForDb.__ajarDb ?? (globalForDb.__ajarDb = createDb());

export const db = cached.db;

// The resolved path this connection actually opened — ':memory:' under
// Vitest, otherwise whatever DATABASE_URL pointed at. Exposed so backup.ts
// can decide where a sibling backups/ directory belongs without
// re-deriving the same VITEST-detection logic a second place.
export const databasePath = databaseUrl;

// Uses SQLite's online backup API (safe to run against a live connection —
// it reads a transactionally-consistent snapshot even if a write lands
// mid-copy) rather than a raw `fs.copyFile`, which could grab a torn file.
// See backup.ts for the scheduling/retention this backs.
export function backupDatabase(destinationPath: string) {
	return cached.client.backup(destinationPath);
}
