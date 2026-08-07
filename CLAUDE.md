# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Database connection is a singleton — don't undo this

`src/lib/server/db/index.ts` caches its `better-sqlite3` connection on `globalThis` deliberately. This is the fix for the root cause behind four real data-loss/corruption incidents in one session (2026-08-06, see `docs/adr/0002-separate-dev-and-docker-databases.md`, "Update 3"): without it, Vite's dev-mode SSR module invalidation re-runs this module's top-level `new Database()` + `migrate()` on requests after editing server files, leaking a new WAL connection each time without closing the old one. If you ever touch this file, keep the `globalThis` caching — reverting to a plain top-level `new Database()` call reintroduces the bug.

## ⚠️ Never point local dev at the same database file Docker uses

This app is often run two ways at once: `docker compose up -d` (the real, long-running instance — check `docker ps` before assuming nothing's running) and `pnpm dev` for local iteration. Both read `DATABASE_URL` from `.env`, and `docker-compose.yml` bind-mounts `./data:/app/data` — so if `.env`'s `DATABASE_URL` points at `data/ajar-books.db` while a Docker container is *also* running, **two separate processes end up with the same SQLite file open in WAL mode at once**: one on the host, one inside Docker Desktop's Linux VM, coordinating (or failing to) over a bind-mounted volume that doesn't reliably support SQLite's shared-memory WAL locking across that boundary. This caused a real, near-total data loss during development (446 books, all reading history, collapsed to ~1 row per table) — see [docs/adr/0002-separate-dev-and-docker-databases.md](docs/adr/0002-separate-dev-and-docker-databases.md) for the full incident and the decision this drove.

**Before running `pnpm dev`:**

1. Run `docker ps` first. If a container from this project is already up, do not point `DATABASE_URL` at `data/ajar-books.db`.
2. `.env`'s `DATABASE_URL` should normally be `local.db` (a dev-only file, gitignored, safe to delete/recreate anytime) — separate from `data/ajar-books.db`, which is Docker's real data path. If you find `.env` pointed at `data/ajar-books.db` while Docker is running, that's a bug in the current setup — fix `.env`, not the other way around.

**⚠️ Never seed or edit a database file with a raw script while a server has it open — this broke `local.db` too, not just the Docker case.** A second incident (same day) showed this isn't specifically about the Docker/host boundary: a raw `better-sqlite3` seed script run against `local.db` *while `pnpm dev` was running* caused the same kind of data collapse, no Docker involved at all. The actual rule: any two processes/connections writing to the same SQLite file — even a plain local dev server plus a one-off script — is unsafe in this app's setup.

**To seed or modify data, always go through the running app itself**, not a raw script:
- The Import wizard (`/import`) — drive it with a real browser session (by hand, or Playwright) to load a CSV. This is the tested, safe path, and works identically against `pnpm dev` (`local.db`) or the Docker instance (`data/ajar-books.db`).
- Or stop every process that has the target file open first, run the raw script, then restart — never both open at once.

**⚠️ A third incident: rebuilding/restarting the Docker container itself can corrupt the database, not just data-loss it.** `docker compose up -d` after a code change recreates the container — stops the old one, starts a new one from the new image. If the old container has a large pending WAL checkpoint (this app has no shutdown signal handling to force one), getting killed mid-checkpoint during that stop can corrupt `data/ajar-books.db`'s header badly enough that SQLite can't open it at all (`SQLITE_NOTADB`), not just lose rows. Prefer `docker compose down` (a real, waited-for stop) before `docker compose up -d --build`, rather than letting `up -d` recreate implicitly. If it happens anyway: move the corrupted file aside (don't delete — keep it in case recovery tools are ever needed), let a fresh container create a new empty database, and re-import from source data.

## Local dev

```bash
pnpm install
pnpm run dev     # http://localhost:5173 (or next free port)
pnpm test        # vitest, uses an in-memory DB — always safe, never touches local.db or data/ajar-books.db
pnpm run check   # svelte-check
```

First run against a fresh `local.db` needs an account created via `/setup` (only works once — locks to `/login` after the first user exists, see `src/hooks.server.ts`).

## Roadmap

See [`ajar-reads-build-roadmap.md`](ajar-reads-build-roadmap.md) for phased build status, and `docs/adr/` for standalone architectural decisions.
