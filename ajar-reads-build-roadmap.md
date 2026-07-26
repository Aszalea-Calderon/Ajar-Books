# Ajar Reads — Build Roadmap

_Phased build order with checklists. Estimates assume part-time, evenings/weekends pace with Claude Code as an active pair-programmer — treat them as rough planning ranges, not commitments._

**One ordering note:** Import (Phase 3) is sequenced _before_ the streak calendar and Insights, not after — importing your real reading history early gives Phases 4 and 5 real data to build and test against, instead of a handful of manually-entered test books.

---

## Phase 0 — Foundation

**Why this order:** everything else depends on a working, deployable skeleton. Getting `docker compose up -d` → login working end-to-end early means deployment problems surface now, not after months of feature work.
**Estimate:** 2-4 sessions

| Done | Task                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| ☑    | Initialize SvelteKit project                                                        |
| ☑    | Write Docker Compose setup (single container)                                       |
| ☑    | Wire up SQLite + Drizzle ORM (schema + migrations)                                  |
| ☑    | Build first-run account creation flow (not open signup)                             |
| ☑    | Build sign-in screen                                                                |
| ☑    | Build empty dashboard shell/layout                                                  |
| ☑    | Set up base design-token architecture (CSS custom properties, one default theme)    |
| ☑    | Verify: clone → `docker compose up -d` → create account → see dashboard, end to end |

---

## Phase 1 — Core Reading Loop

**Why this order:** the core verb of the app (log that you read something) has to exist before anything built on top of it — streaks, insights, goals — means anything.
**Estimate:** 1.5-2 weeks

| Done | Task                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------- |
| ☑    | Integrate Open Library search API                                                              |
| ☑    | Add optional Google Books API key config                                                       |
| ☑    | Build book search UI                                                                           |
| ☑    | Build "add book to library" action (creates `Book` + `UserBook`)                               |
| ☑    | Build book detail page scaffold                                                                |
| ☑    | Add format selection (physical / ebook / audiobook)                                            |
| ☑    | Build progress-logging UI (pages input)                                                        |
| ☑    | Build progress-logging UI (minutes input, for audiobooks)                                      |
| ☑    | Wire progress logging to write `ReadingLog` rows                                               |
| ☑    | Build "Currently Reading" dashboard section                                                    |
| ☑    | Build live progress bar component (page-based)                                                 |
| ☑    | Build live progress bar component (time-based)                                                 |
| ☑    | Verify: search a real book, add it, log progress against both a page-based and time-based book |

---

## Phase 2 — Tagging & Rating

**Why this order:** every downstream Insights chart reads from these fields. Building them before Import and Insights means your data is already tagged/rated by the time you need to visualize it.
**Estimate:** 3-5 days for the editor + mapping-table v1 (expect ongoing light refinement of the mapping table after)

| Done | Task                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| ☑    | Build curated genre-normalization mapping table (raw subjects → clean genre list)    |
| ☑    | Build reusable tag-editor component (chips, add/remove, autocomplete + custom entry) |
| ☑    | Wire tag editor for genre tags                                                       |
| ☑    | Wire tag editor for mood tags                                                        |
| ☑    | Wire tag editor for setting tags                                                     |
| ☑    | Build 5-star, half-increment rating control                                          |
| ☑    | Add tag editors + rating to book detail screen                                       |
| ☑    | Verify: every book can be tagged (genre/mood/setting) and rated                      |

---

## Phase 2.5 — Hardening & Security

**Why this order:** surfaced by a dedicated security-review pass partway through Phase 2. Sequenced here — before Import adds a new untrusted-input surface (parsing other people's Goodreads/StoryGraph export files) — rather than after, since Import is exactly the kind of feature that turns a defense-in-depth gap into a real one.
**Estimate:** half a day for the remaining open items

| Done | Priority | Task                                                                                                                                                                                                                                           |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☑    | High     | Rate-limit failed login attempts (per-IP, lockout after 5 attempts/15 min) — previously nothing stopped brute-forcing the one account                                                                                                          |
| ☑    | High     | Run the Docker container as a non-root user (starts as root only long enough to fix bind-mount ownership, then drops via `gosu`)                                                                                                               |
| ☑    | Medium   | Patch known `cookie` package vulnerability (GHSA-pxg6-pf52-xh8x) via a pnpm override, pinned to the same major version to avoid an API break                                                                                                   |
| ☐    | Low      | Validate `openLibraryId`'s shape (e.g. `/works/OL\d+W`) before using it in outbound fetch URLs in `search.ts` — not exploitable today (gated behind auth + CSRF), but Import will introduce untrusted data that could reach the same code path |
| ☐    | Medium   | Add minimal automated tests for the trickiest logic: status transitions, genre normalization, and Import's parsers once Phase 3 lands                                                                                                          |
| ☐    | Medium   | Turn Phase 7's backup "guidance" into an actual one-click export feature, rather than just docs telling you to copy the SQLite file                                                                                                            |
| ☐    | Low      | Add pagination to Search/Library views once your library grows past ~100+ books — everything currently loads unpaginated                                                                                                                       |

_Not included:_ a theoretical TOCTOU race in first-run account creation was investigated and ruled not worth fixing — this app has no per-user data isolation at all, so a second account would confer no additional access, and the realistic precondition (an untrusted party reaching an unconfigured instance before you complete first-run setup) is an operational concern, not a code one.

---

## Phase 3 — Import

**Why this order:** importing your real history here means Phases 4 and 5 get built and tested against actual books, dates, and genre spread — a much better test than synthetic data.
**Estimate:** ~1 week (fiddlier than it looks — format drift between exports, partial/missing data)

| Done | Task                                                              |
| ---- | ----------------------------------------------------------------- |
| ☐    | Build CSV upload UI                                               |
| ☐    | Build Goodreads export parser                                     |
| ☐    | Build StoryGraph export parser                                    |
| ☐    | Build column-mapping/preview step                                 |
| ☐    | Build async import job processing                                 |
| ☐    | Build import progress indicator                                   |
| ☐    | Build error report for unmatched/malformed rows                   |
| ☐    | Test with a real Goodreads export                                 |
| ☐    | Test with a real StoryGraph export                                |
| ☐    | Verify: your real reading history populates the library correctly |

---

## Phase 4 — Streak Calendar & Goals

**Why this order:** with real historical `ReadingLog` data from the import, the calendar has real content to render against immediately instead of an empty grid.
**Estimate:** 3-5 days

| Done | Task                                                                     |
| ---- | ------------------------------------------------------------------------ |
| ☐    | Build month-grid calendar component                                      |
| ☐    | Populate calendar from `ReadingLog` data                                 |
| ☐    | Build streak counter calculation                                         |
| ☐    | Build day-detail view (tap a day → see books/amount logged)              |
| ☐    | Build goal creation UI (year / month / week)                             |
| ☐    | Build goal progress calculation (book-count or page/minute-based)        |
| ☐    | Build goal progress bar + pace indicator ("on track" / "X behind")       |
| ☐    | Verify: calendar and goals reflect your real imported history accurately |

---

## Phase 5 — Profile & Insights

**Why this order:** the heaviest single phase — five charts plus the reader-type logic. Building it last means you're testing against your actual reading life, which is the only way to judge if the output looks meaningful.
**Estimate:** 1.5-2.5 weeks — budget the most time here

| Done | Task                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------- |
| ☐    | Prototype finished-books graph — heatmap option                                                                |
| ☐    | Prototype finished-books graph — year-over-year bar option                                                     |
| ☐    | Pick final graph direction and build it                                                                        |
| ☐    | Build favorites shelf UI                                                                                       |
| ☐    | Compute reader-type stats (dominant genre, pace, fiction/non-fiction ratio)                                    |
| ☐    | Build reader-type templated summary (multiple phrasing variants)                                               |
| ☐    | Build genre breakdown chart (donut/bar)                                                                        |
| ☐    | Build most-read-authors ranked list                                                                            |
| ☐    | Build pace stats display (days/book, pages/day, minutes/day)                                                   |
| ☐    | Build fiction vs. non-fiction split chart                                                                      |
| ☐    | Build monthly combo chart (books finished / minutes listened / pages read)                                     |
| ☐    | Verify: every chart renders correctly against real history; reader-type summary reads as genuinely descriptive |

---

## Phase 6 — Theming

**Why this order:** by now every screen exists, so presets get designed/tested against the full real app — easier to catch a preset that looks bad on a screen you hadn't built yet.
**Estimate:** 2-4 days

| Done | Task                                                          |
| ---- | ------------------------------------------------------------- |
| ☐    | Design additional color presets beyond the Phase 0 default    |
| ☐    | Implement preset switching (token overrides)                  |
| ☐    | Build theme picker UI in Settings                             |
| ☐    | QA all presets across every screen                            |
| ☐    | QA illustrations across all presets (light + dark especially) |

---

## Phase 7 — Stretch / Polish

_Not required for a usable v1 — pick up in whatever order suits you._

| Done | Task                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| ☐    | Add `OLLAMA_URL` config option                                                          |
| ☐    | Build reader-type AI rephrasing prompt (grounded in computed stats, not free-generated) |
| ☐    | Fallback to Phase 5 template when `OLLAMA_URL` is unset                                 |
| ☐    | Add PWA manifest + icons                                                                |
| ☐    | Build data export (CSV/JSON)                                                            |
| ☐    | Write backup guidance (copy the SQLite file)                                            |
| ☐    | Write Cloudflare Tunnel setup docs                                                      |

---

## Total rough estimate

Roughly **6-10 weeks** part-time, end to end, for a genuinely full v1 as scoped. Phase 5 (Insights) and Phase 3 (Import) are the two most likely to run over — plan slack around those rather than the earlier phases.
