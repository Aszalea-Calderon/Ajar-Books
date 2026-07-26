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

| Done | Task                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☑    | Integrate Open Library search API                                                                                                                                   |
| ☑    | Add optional Google Books API key config                                                                                                                            |
| ☑    | Build book search UI                                                                                                                                                |
| ☑    | Build "add book to library" action (creates `Book` + `UserBook`)                                                                                                    |
| ☑    | Build book detail page scaffold                                                                                                                                     |
| ☑    | Add format selection (physical / ebook / audiobook) — original always-visible-pills implementation; being reworked into the "Start Reading" modal flow in Phase 2.6 |
| ☑    | Build progress-logging UI (pages input)                                                                                                                             |
| ☑    | Build progress-logging UI (minutes input, for audiobooks)                                                                                                           |
| ☑    | Wire progress logging to write `ReadingLog` rows                                                                                                                    |
| ☑    | Build "Currently Reading" dashboard section                                                                                                                         |
| ☑    | Build live progress bar component (page-based)                                                                                                                      |
| ☑    | Build live progress bar component (time-based)                                                                                                                      |
| ☑    | Verify: search a real book, add it, log progress against both a page-based and time-based book                                                                      |

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

| Done | Priority | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☑    | High     | Rate-limit failed login attempts (per-IP, lockout after 5 attempts/15 min) — previously nothing stopped brute-forcing the one account                                                                                                                                                                                                                                                                                                                         |
| ☑    | High     | Run the Docker container as a non-root user (starts as root only long enough to fix bind-mount ownership, then drops via `gosu`)                                                                                                                                                                                                                                                                                                                              |
| ☑    | Medium   | Patch known `cookie` package vulnerability (GHSA-pxg6-pf52-xh8x) via a pnpm override, pinned to the same major version to avoid an API break                                                                                                                                                                                                                                                                                                                  |
| ☐    | Low      | Validate `openLibraryId`'s shape (e.g. `/works/OL\d+W`) before using it in outbound fetch URLs in `search.ts` — not exploitable today (gated behind auth + CSRF), but Import will introduce untrusted data that could reach the same code path                                                                                                                                                                                                                |
| ☑    | Medium   | Add minimal automated tests for the trickiest logic: status transitions, genre normalization, and tag/library dedup (`vitest`, 48 tests) — extend to Import's parsers once Phase 3 lands                                                                                                                                                                                                                                                                      |
| ☐    | Medium   | Build a one-click data export (CSV/JSON) — moved up from Phase 7 so there's a real snapshot mechanism before Import runs a bulk write against your data, not just docs telling you to copy the SQLite file. (Phase 7's SQLite-copy backup guidance is a separate, complementary mechanism — file-level vs. in-app — not a duplicate of this)                                                                                                                  |
| ☐    | Low      | Add pagination to Search/Library views once your library grows past ~100+ books — everything currently loads unpaginated                                                                                                                                                                                                                                                                                                                                      |
| ☑    | Medium   | Filter/clean "About the book" descriptions pulled from Open Library/Google Books before display — strip spam link patterns (e.g. `[**PDF**](...)` markdown-link junk seen in real Open Library data) rather than fabricating or hiding real content. Keep rendering as plain text (never `{@html}`/Markdown) — descriptions are untrusted external data, and rendering them as rich HTML would turn embedded spam links into a real XSS/open-redirect surface |

_Not included:_ a theoretical TOCTOU race in first-run account creation was investigated and ruled not worth fixing — this app has no per-user data isolation at all, so a second account would confer no additional access, and the realistic precondition (an untrusted party reaching an unconfigured instance before you complete first-run setup) is an operational concern, not a code one.

---

## Phase 2.6 — Book Detail Refinements

**Why this order:** these make the core tracking experience correctable before Import brings in your whole reading history at once — a wrong page count, a status that should've been "finished," or a book that shouldn't have been added are all far more likely to show up at Import scale than one book at a time, so the tools to fix them are worth having first.
**Estimate:** 3-5 days

| Done | Task                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ☑    | Add "About the book" panel (real synopsis + page count pulled from Open Library/Google Books, never fabricated), laid out side-by-side with the Genre/Mood/Setting panel rather than stacked below it                                                                                                                                            |
| ☑    | Allow editing an existing reading-log entry (amount and note) instead of only ever being able to add new ones                                                                                                                                                                                                                                    |
| ☑    | Reframe the Activity panel as "Chapter Notes" — a note-centric, editable journal rather than just an auto-generated log of progress timestamps                                                                                                                                                                                                   |
| ☑    | Add a manual status control (Want to Read / Currently Reading / Finished / Did Not Finish) independent of the automatic progress-based transitions                                                                                                                                                                                               |
| ☑    | Add a "Remove book" action, distinct from the existing hard Delete — resets the book to its default state (want to read, no progress/format) rather than erasing its history, as a softer alternative to full deletion                                                                                                                           |
| ☑    | Make the dashboard's Currently Reading chips swap which book is shown in the hero "Track Progress" card, instead of navigating to that book's own detail page — matches the original Homepage wireframe, for switching between multiple in-progress books without leaving the dashboard                                                          |
| ☐    | Make the author name on the book detail page clickable — show other books by that author (Open Library's author-works endpoint; Google Books can search by author as a fallback)                                                                                                                                                                 |
| ☐    | Detect and surface series membership (e.g. "Book 2 of _Dune_") plus links to other books in the series, when the source API exposes that data — not fabricated if the API has no series info for a given book                                                                                                                                    |
| ☐    | Show a community rating (Google Books' `averageRating`/`ratingsCount`, or Open Library's `/works/{id}/ratings.json`) alongside your own star rating — your own rating takes visual precedence once you've set one; the community rating shows as a fallback/reference when you haven't                                                           |
| ☑    | Extract the status dropdown and format-picker pills out of the book detail page into their own reusable components (`StatusControl.svelte`, `FormatModal.svelte`) — prep work for the two items below                                                                                                                                            |
| ☑    | Restyle the status control (Want to Read / Currently Reading / Finished / DNF) to match the rest of the platform's control styling — now a pill row instead of a plain `<select>`                                                                                                                                                                |
| ☑    | Replace the always-visible format-toggle pills with a single "Start Reading" action: clicking it opens a modal to pick format + starting total, and always sets status straight to Currently Reading (even from Want to Read). Once reading has started, a separate "Change format" action stays available so format isn't locked in permanently |
| ☑    | Verify (round 1): the first batch of Phase 2.6 refinements (About panel, editable logs, Chapter Notes, manual status, Remove book, dashboard swap) works end-to-end against the real Docker container                                                                                                                                            |
| ☐    | Verify (round 2): the second batch (author/series/rating, component extraction, Start Reading redesign) works end-to-end before moving to Phase 2.7                                                                                                                                                                                              |

---

## Phase 2.7 — Library Browsing & Filtering

**Why this order:** extends the same "fix at one-book scale before Import brings a whole history at once" logic as Phase 2.6 — once Import lands you may have hundreds of books at once, and filtering only helps if it exists before that flood arrives. Pairs naturally with the pagination item already flagged in Phase 2.5.

**Estimate:** 3-5 days

| Done | Task                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐    | Build a dedicated Library page listing every added book (currently only reachable indirectly via Search or the dashboard's Currently Reading section)                                     |
| ☐    | Filter the Library page by genre / mood / setting / status (want to read, reading, finished, DNF) / format / rating                                                                       |
| ☐    | Add lightweight filters to the external Search page's results (e.g. hide results already in your library, filter by format availability) — smaller in scope than the Library page filters |
| ☐    | Verify: with a library of tagged, mixed-status books, every filter combination returns the expected set                                                                                   |

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

| Done | Task                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| ☑    | Design additional color presets beyond the Phase 0 default (currently just Light; more can follow)                       |
| ☑    | Implement preset switching (token overrides)                                                                             |
| ☑    | Build theme picker UI in Settings                                                                                        |
| ☑    | Add a custom accent-color picker (goes beyond fixed presets — freeform color choice with auto-computed contrasting text) |
| ☐    | QA all presets across every screen                                                                                       |
| ☐    | QA illustrations across all presets (light + dark especially)                                                            |

---

## Phase 7 — Stretch / Polish

_Not required for a usable v1 — pick up in whatever order suits you._

| Done | Task                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐    | Add `OLLAMA_URL` config option                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ☐    | Build reader-type AI rephrasing prompt (grounded in computed stats, not free-generated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ☐    | Fallback to Phase 5 template when `OLLAMA_URL` is unset                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ☐    | Add PWA manifest + icons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ☐    | Cache cover images locally at add-time instead of hot-linking (book metadata is already stored locally — this closes the one remaining offline gap, and pairs naturally with the PWA work above)                                                                                                                                                                                                                                                                                                                                                                          |
| ☐    | Add a "Delete your data" section in Settings — wipes the whole library/account, clearly labeled as permanent and unrecoverable, gated behind a typed confirmation (not just a browser `confirm()` dialog, given the stakes) rather than a single click                                                                                                                                                                                                                                                                                                                    |
| ☐    | Write backup guidance (copy the SQLite file)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ☐    | Write Cloudflare Tunnel setup docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ☐    | Write `docs/ARCHITECTURE.md` (referenced by the README's Contributing section but never created) — tech stack and key decisions, worth having before opening the project to outside contributors                                                                                                                                                                                                                                                                                                                                                                          |
| ☐    | Build a first-login onboarding tutorial (walk through search → add → format → log progress → tag/rate, so the core loop is discoverable without external docs)                                                                                                                                                                                                                                                                                                                                                                                                            |
| ☐    | _Much later stretch:_ explore adding Ajar Books to a Home Assistant setup (e.g. a custom integration/card surfacing current streak, currently-reading, or goal progress on a HA dashboard)                                                                                                                                                                                                                                                                                                                                                                                |
| ☐    | Evaluate additional optional book-metadata API keys, following the same opt-in pattern as the Google Books key: **ISBNdb** (paid, key-based — deeper ISBN/edition coverage than Open Library alone) and **Wikidata/Wikipedia REST API** (no key required — supplementary synopsis source for public-domain/classic titles Open Library's description field often lacks). Goodreads' API is closed to new developer keys and isn't an option; only add a source if it demonstrably fills a real coverage gap, gated behind the existing per-source opt-in settings pattern |

---

## Phase 8 — Final Security Audit

**Why this order:** last, on purpose — a meaningful security self-assessment is most useful once the app's full surface area (Import's file parsing, Insights' data handling, any AI/Ollama integration) actually exists, rather than re-running it after every phase.

**Estimate:** 1-2 days

| Done | Task                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐    | Run a full app security review, self-assessed against relevant NIST guidance — the applicable control catalog is **NIST SP 800-53** (access control, audit logging, session management) and **NIST SP 800-218 (SSDF)** for secure-development practices. Note: NIST doesn't certify individual applications, so this is a documented self-assessment against their published controls, not a formal certification |
| ☐    | Re-verify every Phase 2.5 hardening item still holds (rate limiting, non-root Docker, dependency patches) plus anything Import/Insights introduced since                                                                                                                                                                                                                                                          |
| ☐    | Document findings and any accepted risks in this roadmap, same format as Phase 2.5's "Not included" note                                                                                                                                                                                                                                                                                                          |

---

## Total rough estimate

Roughly **6-10 weeks** part-time, end to end, for a genuinely full v1 as scoped. Phase 5 (Insights) and Phase 3 (Import) are the two most likely to run over — plan slack around those rather than the earlier phases.
