import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { backupDatabase, databasePath } from '$lib/server/db';

// Real motivation: a corrupted/emptied database has happened before (see
// docs/adr/0002) with no backup to fall back on. Sibling `backups/`
// directory next to the live db file, not the same path — so a bad write
// or a corrupted header on the live file can't take the backups with it.
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 10_000;
export const KEEP_COUNT = 7;

export function backupPaths(dbPath: string) {
	const dir = join(dirname(dbPath), 'backups');
	const stem = basename(dbPath, extname(dbPath));
	return { dir, stem };
}

function timestamp(): string {
	// Colons aren't safe in filenames on every filesystem this might run on.
	return new Date().toISOString().replace(/:/g, '-');
}

// Takes an explicit path (rather than always reading the module-level
// databasePath) so tests can point it at a scratch directory instead of
// ever running this against ':memory:' — dirname(':memory:') is '.', which
// would otherwise create a real backups/ folder in the working directory.
export async function runBackup(dbPath: string): Promise<void> {
	const { dir, stem } = backupPaths(dbPath);
	mkdirSync(dir, { recursive: true });
	await backupDatabase(join(dir, `${stem}-${timestamp()}.db`));

	const files = readdirSync(dir)
		.filter((name) => name.startsWith(`${stem}-`) && name.endsWith('.db'))
		.map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
		.sort((a, b) => b.mtime - a.mtime);

	for (const stale of files.slice(KEEP_COUNT)) {
		unlinkSync(join(dir, stale.name));
	}
}

const globalForBackup = globalThis as typeof globalThis & { __ajarBackupScheduled?: boolean };

// Same globalThis-guard pattern as db/index.ts's connection cache — without
// it, Vite's dev-mode module re-evaluation would stack up a new interval on
// every server-file edit rather than running just one per process.
export function scheduleBackups(): void {
	if (globalForBackup.__ajarBackupScheduled) return;
	globalForBackup.__ajarBackupScheduled = true;

	if (databasePath === ':memory:') return; // vitest — nothing to back up

	const runBackupSafely = () => {
		// A failed backup (disk full, permissions) shouldn't crash the whole
		// server — it's a background task, not a request in flight.
		runBackup(databasePath).catch((err) => console.error('Scheduled database backup failed:', err));
	};
	setTimeout(runBackupSafely, STARTUP_DELAY_MS);
	setInterval(runBackupSafely, BACKUP_INTERVAL_MS);
}
