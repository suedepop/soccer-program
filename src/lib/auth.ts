import 'server-only';
import bcrypt from 'bcryptjs';
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
