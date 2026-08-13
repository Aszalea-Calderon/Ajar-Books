import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeSync, mkdirSync, mkdtempSync, openSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupPaths, KEEP_COUNT, runBackup } from './backup';

let scratchDir: string;

beforeEach(() => {
	scratchDir = mkdtempSync(join(tmpdir(), 'ajar-backup-test-'));
});

afterEach(() => {
	rmSync(scratchDir, { recursive: true, force: true });
});

describe('backupPaths', () => {
	it('puts backups in a sibling directory named after the db file', () => {
		const { dir, stem } = backupPaths('/data/ajar-books.db');
		expect(dir).toBe('/data/backups');
		expect(stem).toBe('ajar-books');
	});
});

describe('runBackup', () => {
	it('writes a timestamped backup file into a sibling backups/ directory', async () => {
		const dbPath = join(scratchDir, 'ajar-books.db');

		await runBackup(dbPath);

		const files = readdirSync(join(scratchDir, 'backups'));
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^ajar-books-.+\.db$/);
	});

	it('prunes down to the newest KEEP_COUNT backups, oldest first', async () => {
		const dbPath = join(scratchDir, 'ajar-books.db');
		const backupDir = join(scratchDir, 'backups');
		mkdirSync(backupDir, { recursive: true });

		// Seed more than KEEP_COUNT pre-existing "backups" with distinct,
		// increasing mtimes, so pruning has an unambiguous oldest-first order
		// to remove from — real backups only ever differ by their mtime, not
		// by name sorting, since the timestamp is baked into the filename but
		// runBackup prunes by mtime specifically.
		const seededCount = KEEP_COUNT + 3;
		const seededNames: string[] = [];
		for (let i = 0; i < seededCount; i++) {
			const name = `ajar-books-seed-${i}.db`;
			const path = join(backupDir, name);
			closeSync(openSync(path, 'w'));
			utimesSync(path, new Date(i * 1000), new Date(i * 1000));
			seededNames.push(name);
		}

		await runBackup(dbPath);

		const filesAfter = readdirSync(backupDir);
		expect(filesAfter).toHaveLength(KEEP_COUNT);
		// The 3 oldest seeded files should be the ones pruned; the newest
		// seeded files plus the just-written backup should remain.
		expect(filesAfter).not.toContain(seededNames[0]);
		expect(filesAfter).not.toContain(seededNames[1]);
		expect(filesAfter).not.toContain(seededNames[2]);
		expect(filesAfter).toContain(seededNames[seededCount - 1]);
	});
});
