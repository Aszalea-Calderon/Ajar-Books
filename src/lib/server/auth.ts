import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sessionSecret() {
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET is not set');
	return secret;
}

function hashToken(token: string) {
	return createHmac('sha256', sessionSecret()).update(token).digest('hex');
}

export function hashPassword(password: string) {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
	const [salt, hash] = stored.split(':');
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, 'hex');
	return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
	const token = randomBytes(32).toString('base64url');
	await db.insert(sessions).values({
		id: hashToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
	});
	return token;
}

export async function validateSessionToken(token: string) {
	const id = hashToken(token);
	const [row] = await db
		.select({ user: users, session: sessions })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id));

	if (!row) return { user: null, session: null };

	if (row.session.expiresAt.getTime() < Date.now()) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return { user: null, session: null };
	}

	return row;
}

export async function invalidateSession(token: string) {
	await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function setSessionCookie(cookies: import('@sveltejs/kit').Cookies, token: string) {
	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		// Defaults to plain HTTP since the documented quick-start is http://localhost:3000
		// with no TLS. Set SECURE_COOKIES=true once serving over HTTPS (e.g. behind a
		// Cloudflare Tunnel or reverse proxy terminating TLS).
		secure: env.SECURE_COOKIES === 'true',
		sameSite: 'lax',
		maxAge: SESSION_DURATION_MS / 1000
	});
}

export function clearSessionCookie(cookies: import('@sveltejs/kit').Cookies) {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

export function getSessionCookie(cookies: import('@sveltejs/kit').Cookies) {
	return cookies.get(SESSION_COOKIE_NAME);
}

export async function hasAnyUser() {
	const [row] = await db.select({ id: users.id }).from(users).limit(1);
	return !!row;
}

/** Returns false for an empty/whitespace-only name or one already taken (the `users.username` unique constraint). */
export async function updateUsername(userId: string, username: string): Promise<boolean> {
	const trimmed = username.trim();
	if (!trimmed) return false;
	try {
		await db.update(users).set({ username: trimmed }).where(eq(users.id, userId));
		return true;
	} catch {
		return false;
	}
}

// Null clears it back to the initial-letter fallback — the picker's own
// "Aa" option submits an empty string for exactly that. No validation
// against the curated emoji list: an unrecognized value just renders as
// literal text in the avatar circle, which is harmless.
export async function updateAvatarEmoji(userId: string, emoji: string | null): Promise<void> {
	await db.update(users).set({ avatarEmoji: emoji }).where(eq(users.id, userId));
}

export type UpdatePasswordResult = 'ok' | 'wrong-current' | 'too-short';

// Same 8-char minimum as /setup and /recover's PasswordField — gated behind
// the current password (not just being logged in), since a still-valid
// session cookie left signed in on a shared/borrowed device shouldn't alone
// be enough to lock the real owner out.
export async function updatePassword(
	userId: string,
	currentPassword: string,
	newPassword: string
): Promise<UpdatePasswordResult> {
	const [user] = await db.select().from(users).where(eq(users.id, userId));
	if (!user || !verifyPassword(currentPassword, user.passwordHash)) return 'wrong-current';
	if (newPassword.length < 8) return 'too-short';

	await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, userId));
	return 'ok';
}

// Groups of 4 from a 32-character alphabet that drops visually-confusable
// characters (0/O, 1/I/L) — meant to be hand-typed from a written-down copy
// without ambiguity, the same reasoning as Crockford base32.
const RECOVERY_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_KEY_GROUPS = 4;
const RECOVERY_KEY_GROUP_LENGTH = 4;

function generateRecoveryKeyPlaintext(): string {
	const groups: string[] = [];
	for (let g = 0; g < RECOVERY_KEY_GROUPS; g++) {
		let group = '';
		const bytes = randomBytes(RECOVERY_KEY_GROUP_LENGTH);
		for (let i = 0; i < RECOVERY_KEY_GROUP_LENGTH; i++) {
			group += RECOVERY_KEY_ALPHABET[bytes[i] % RECOVERY_KEY_ALPHABET.length];
		}
		groups.push(group);
	}
	return groups.join('-');
}

/**
 * Generates a fresh recovery key for this app's one user, stores only its
 * hash, and returns the plaintext — the one and only time it's ever visible
 * again after this call returns. Overwrites (invalidates) any previous key.
 */
export async function generateRecoveryKey(userId: string): Promise<string> {
	const plaintext = generateRecoveryKeyPlaintext();
	await db
		.update(users)
		.set({ recoveryKeyHash: hashPassword(plaintext) })
		.where(eq(users.id, userId));
	return plaintext;
}

export async function hasRecoveryKey(userId: string): Promise<boolean> {
	const [user] = await db.select({ recoveryKeyHash: users.recoveryKeyHash }).from(users).where(eq(users.id, userId));
	return !!user?.recoveryKeyHash;
}

/**
 * Verifies a recovery key against the single user account and, if it
 * matches, sets the new password and clears the key (single-use — see the
 * schema comment on users.recoveryKeyHash for why). Normalizes the input
 * key the same way it was generated (uppercase, dash-grouped) so a user
 * retyping it isn't tripped up by case.
 */
/**
 * Returns the user's id on success (so the caller can immediately issue a
 * fresh recovery key — see /recover's action) or null on failure. Not a
 * plain boolean specifically so a successful reset can chain straight into
 * generateRecoveryKey without a second lookup.
 */
export async function resetPasswordWithRecoveryKey(
	key: string,
	newPassword: string
): Promise<string | null> {
	const [user] = await db.select().from(users);
	if (!user?.recoveryKeyHash) return null;

	const normalized = key.trim().toUpperCase();
	if (!verifyPassword(normalized, user.recoveryKeyHash)) return null;

	await db
		.update(users)
		.set({ passwordHash: hashPassword(newPassword), recoveryKeyHash: null })
		.where(eq(users.id, user.id));
	return user.id;
}
