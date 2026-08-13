# Ajar Books

A self-hosted, privacy-first reading tracker. Track what you're reading, watch your reading streak build, set goals, and see real insights into your reading habits — all on your own server, with your own data.

> 🚧 **Status: early development.** This project is being actively built — see [Roadmap](#roadmap) for current progress. Not yet ready for production use.

## Why

Most reading trackers (GoodReads, StoryGraph, Fable) require an account with a third party and keep your reading data on their servers. Ajar Reads is the same idea — streaks, goals, insights, a shelf of favorites — but self-hosted: your SQLite database, your server, your data, full stop.

## Features

- **Search & Want to Read** — search Open Library/Google Books, add books to your library, and track them through Want to Read → Currently Reading → Finished/DNF
- **Currently reading** — track progress across physical books, ebooks, and audiobooks (page-based, time-based, or percent)
- **Reading streak** — a Fable-style monthly calendar showing which books you read on which days
- **Reading goals** — yearly, monthly, and weekly targets, book-count or page/minute-based
- **Finished books** — full history, filterable
- **Profile** — a full graph of everything you've finished, a favorites shelf, and a generated summary of what kind of reader you are
- **Reading insights** — genre breakdown, most-read authors, pace, fiction vs. non-fiction split, and a monthly chart of books/minutes/pages
- **Genre, mood, and setting tagging** — with sensible defaults and full manual control
- **Import** — bring your history in from Goodreads or StoryGraph CSV exports
- **Themeable** — light/dark and multiple accent presets
- **Installable** — works as a PWA

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) (frontend + backend, single deployable app)
- [SQLite](https://www.sqlite.org/) via [Drizzle ORM](https://orm.drizzle.team/)
- [Open Library API](https://openlibrary.org/developers/api) for book search and metadata (optional Google Books API key for extended coverage)
- Docker / Docker Compose for deployment

## Quick Start

```bash
git clone https://github.com/Aszalea-Calderon/Ajar-Books
cd Ajar-Books
cp .env.example .env  # then set SESSION_SECRET
docker compose up -d
```

Visit `http://localhost:3000` and create your account on first run.

## Configuration

Copy `.env.example` to `.env` and set:

| Variable               | Required | Description                                                                                                                                                                   |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`       | Yes      | Random string used to sign session cookies                                                                                                                                    |
| `ORIGIN`               | No       | Docker only — the origin SvelteKit should trust for form submissions. Defaults to `http://localhost:3000`; override for a different host/port, LAN address, or domain/tunnel. |
| `GOOGLE_BOOKS_API_KEY` | No       | Enables Google Books as a metadata source for better cover art/coverage                                                                                                       |
| `OLLAMA_URL`           | No       | Point at an existing Ollama instance to enable AI-enhanced phrasing of your reader-type summary. Falls back to a templated summary if unset.                                  |
| `SECURE_COOKIES`       | No       | Set to `true` once serving over HTTPS (reverse proxy/Cloudflare Tunnel) to mark session cookies `Secure`. Leave unset for plain `http://` access.                             |

## Data & Privacy

- No analytics, no telemetry
- Book search/metadata is pulled from [Open Library](https://openlibrary.org/), a third-party service, by default — no account or API key needed. Optional additional sources (Google Books, Ollama) only get called if you configure a key/URL yourself
- All data lives in a single SQLite file
- One-click data export (JSON) is available from your Profile page at any time

## Backups

The app takes care of this automatically: every 24 hours (starting shortly after the server comes up), it writes a timestamped snapshot into a `backups/` folder next to the live database — `data/backups/` under Docker Compose, since `data/` is the bind-mounted volume, so backups land on the host disk too, not just inside the container. It keeps the 7 most recent and prunes older ones on its own. Snapshots are taken through SQLite's own online-backup API rather than a plain file copy, so it's safe to run against the live connection even mid-write.

That's a safety net against corrupting or losing the live file (see [docs/adr/0002](docs/adr/0002-separate-dev-and-docker-databases.md) for why that's not hypothetical) — it isn't off-host or off-disk redundancy. If you want protection against losing the whole machine/disk, periodically copy `data/backups/` (or the live `data/ajar-books.db` file) somewhere else yourself — a second disk, cloud storage, wherever. Either is a plain file, safe to copy at rest; just avoid copying `data/ajar-books.db` itself while the container is running (copy from `data/backups/` instead, or stop the container first) so you're never reading it mid-write.

## Roadmap

See [`ajar-reads-build-roadmap.md`](ajar-reads-build-roadmap.md) for the phased build plan and current progress.

## Contributing

Contributions are welcome once the core is further along — check open issues, or see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the project's technical decisions and reasoning before proposing changes.

Have a feature request or run into a bug? Feel free to open a ticket — we're happy to take a look.

## License

Licensed under [AGPL-3.0](LICENSE). This means: if you run a modified version of Ajar Reads as a network service, you're required to make your modified source available to your users. See the [LICENSE](LICENSE) file for full terms.

The "Ajar Reads" name and its illustration/logo assets are not covered by the code license — forks should use their own name and branding.

## Acknowledgments

Book search and metadata powered by [Open Library](https://openlibrary.org/), an [Internet Archive](https://archive.org/) project.

# Ajar-Books
