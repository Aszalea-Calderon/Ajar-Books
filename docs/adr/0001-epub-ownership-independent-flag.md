# 0001. EPUB ownership as an independent flag, not reused format

**Status:** Accepted

## Context

Phase 4.5 adds the ability to store and read EPUB files for books the user already owns. This needs to be represented in the data model, and needs to leave room for a future feature tying "owned" status to checking books out through the app's existing Open Library integration — a direction raised during roadmap planning on 2026-08-05 but not yet scoped. Without an explicit decision, the natural default — given `userBooks.format` already exists with `physical`/`ebook`/`audiobook` values — would be to set `format = 'ebook'` automatically whenever an EPUB is uploaded, collapsing "owns a digital copy" into the existing reading-format field.

## Decision

Ownership is tracked independently of `format`: a nullable `epubPath` column on `userBooks`, set when a file is stored. A book's `format` (how the user is currently reading it) and whether they own a stored EPUB of it are two separate facts that don't imply each other.

## Alternatives considered

- **Reuse `format`, set to `'ebook'` on upload** — no schema change, but conflates "how I'm currently reading this" with "what I own a copy of." A user tracking a book as `physical` who also owns the EPUB would have their format silently overwritten, and a future check-out/borrow concept would have nowhere to attach that isn't already overloaded.
- **Add a separate boolean `ownsEpub` distinct from file storage** — would let ownership exist without an uploaded file (e.g. a future "own it but haven't uploaded it" state), but rejected for now: Phase 4.5's only way to establish ownership *is* uploading a file, so a boolean would just duplicate `epubPath IS NOT NULL`. Revisit if a future phase needs to record ownership independent of a stored file.

## Consequences

Future work building on "owned" status (e.g. an Open Library check-out/borrow tie-in) should read `epubPath IS NOT NULL` rather than `format = 'ebook'`. If a later phase needs ownership to exist without a stored file, this decision should be revisited — at that point the rejected boolean-column alternative becomes the right call.
