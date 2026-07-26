/**
 * In-memory login attempt limiter, keyed by client IP. This is a single-user,
 * single-process app — no need for a distributed store. Note: if deployed
 * behind a reverse proxy, this only works correctly once the adapter is
 * configured to trust the proxy's forwarded-for header (see adapter-node's
 * ADDRESS_HEADER/XFF_DEPTH), otherwise every client appears to share one IP.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type Attempt = { count: number; firstAttempt: number; lockedUntil?: number };

const attempts = new Map<string, Attempt>();

function prune(now: number) {
	for (const [key, entry] of attempts) {
		const expiry = entry.lockedUntil ?? entry.firstAttempt + WINDOW_MS;
		if (expiry <= now) attempts.delete(key);
	}
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
	const now = Date.now();
	prune(now);

	const entry = attempts.get(key);
	if (entry?.lockedUntil && entry.lockedUntil > now) {
		return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
	}

	return { allowed: true };
}

export function recordFailedAttempt(key: string) {
	const now = Date.now();
	const entry = attempts.get(key);

	if (!entry || now - entry.firstAttempt > WINDOW_MS) {
		attempts.set(key, { count: 1, firstAttempt: now });
		return;
	}

	entry.count += 1;
	if (entry.count >= MAX_ATTEMPTS) {
		entry.lockedUntil = now + LOCKOUT_MS;
	}
}

export function clearAttempts(key: string) {
	attempts.delete(key);
}
