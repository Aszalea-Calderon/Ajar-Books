// Mirrors userBooks.status in $lib/server/db/schema.ts — redeclared here
// (rather than imported from $lib/server) so this stays safe to import from
// both client and server code without ever reaching across that boundary.
export type BookStatus = 'added' | 'want_to_read' | 'reading' | 'finished' | 'dnf';

// 'added' (the transient just-added-nothing-decided-yet marker) is
// deliberately excluded — it's never surfaced as a real status anywhere in
// the UI, so there's no display label for it.
export const STATUS_LABELS: Record<Exclude<BookStatus, 'added'>, string> = {
	want_to_read: 'Want to Read',
	reading: 'Currently Reading',
	finished: 'Finished',
	dnf: 'Did Not Finish'
};
