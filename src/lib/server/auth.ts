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
