import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const COOKIE = 'whs_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set to at least 32 characters in production.');
    }
    // Dev convenience only — sessions reset when you change this.
    return new TextEncoder().encode('dev-only-insecure-secret-do-not-ship-0000');
  }
  return new TextEncoder().encode(raw);
}

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  is_admin: number;
  created_at: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: number): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Returns the signed-in user, or null. Never throws. */
export async function currentUser(): Promise<User | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    const uid = payload.uid;
    if (typeof uid !== 'number') return null;
    const row = db()
      .prepare('SELECT id, email, name, phone, is_admin, created_at FROM users WHERE id = ?')
      .get(uid) as User | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/** For pages/handlers that must have a user. Throws a 401-ish sentinel. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new AuthError('Not signed in', 401);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.is_admin) throw new AuthError('Admins only', 403);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function findUserByEmail(email: string) {
  return db()
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as
    | (User & { password_hash: string })
    | undefined;
}

export function countUsers(): number {
  const row = db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return row.n;
}

// ----------------------------------------------------------------- admin --

/**
 * The admin screen has its own credentials, separate from parent accounts. It
 * is not linked from anywhere; a booster types /admin and signs in there.
 *
 * These live here, not in config.ts, and this module is server-only. config.ts
 * is reachable from the client graph — AdCanvas imports it and is rendered from
 * a 'use client' component — and parts of it really do ship: AD_SIZES and even
 * SCHOOL.mascot are in .next/static after a build. Whether any *particular*
 * export survives comes down to tree-shaking, which is not a guarantee worth
 * betting a password on. `import 'server-only'` is: it fails the build if this
 * module is ever pulled into a client component.
 *
 * Set ADMIN_USERNAME / ADMIN_PASSWORD in the deployment environment. The
 * fallbacks below are committed to the repository — treat them as public.
 */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Soccer26!';

/**
 * Compares two secrets without leaking their contents through how long the
 * comparison takes. timingSafeEqual needs equal lengths, so both sides are
 * hashed to a fixed 32 bytes first — that also stops the length of the real
 * password being measurable.
 */
function sameSecret(given: string, expected: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(expected).digest()
  );
}

/**
 * The admin's user row. It exists so the rest of the app has something to hang
 * `is_admin` on — every per-ad and per-file permission check already reads that
 * flag off a normal session, and inventing a second kind of session would mean
 * teaching all of them a new trick.
 *
 * Its stored password is random and thrown away, so this row cannot be signed
 * into from the parents' login form. The configured password above is the only
 * way in.
 */
function ensureAdminUser(): number {
  const conn = db();
  const existing = conn.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_USERNAME) as
    | { id: number }
    | undefined;

  if (existing) {
    conn.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    return existing.id;
  }

  const unusable = bcrypt.hashSync(randomBytes(32).toString('hex'), 10);
  const info = conn
    .prepare(
      "INSERT INTO users (email, password_hash, name, phone, is_admin) VALUES (?, ?, ?, '', 1)"
    )
    .run(ADMIN_USERNAME, unusable, 'Boosters');
  return Number(info.lastInsertRowid);
}

/**
 * Checks the admin credentials and, on a match, signs the browser in as the
 * admin. Replaces any parent session that was already there, which is the
 * behaviour a shared family computer wants anyway.
 */
export async function signInAdmin(username: string, password: string): Promise<boolean> {
  // Both are checked even when the username is already wrong, so a bad username
  // does not come back faster than a bad password.
  const userOk = sameSecret(username.trim(), ADMIN_USERNAME);
  const passOk = sameSecret(password, ADMIN_PASSWORD);
  if (!userOk || !passOk) return false;

  await createSession(ensureAdminUser());
  return true;
}
