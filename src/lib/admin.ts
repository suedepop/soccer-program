import 'server-only';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { hashPassword, isAdminCredentialAccount } from './auth';

/** One row of the admin's account list. */
export interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone: string;
  isAdmin: boolean;
  /** The ADMIN_PASSWORD stub rather than a real person — cannot be reset here. */
  isCredentialRow: boolean;
  createdAt: string;
  ads: number;
  photos: number;
  /** Last successful sign-in, or null if they never have. */
  lastLoginAt: string | null;
}

export function listUsers(): AdminUser[] {
  const rows = db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.is_admin, u.created_at,
              (SELECT COUNT(*) FROM ads a WHERE a.user_id = u.id) AS ads,
              (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id) AS photos,
              (SELECT MAX(e.created_at) FROM login_events e
                WHERE e.user_id = u.id AND e.kind IN ('login', 'admin')) AS last_login
         FROM users u
        ORDER BY u.created_at DESC, u.id DESC`
    )
    .all() as {
    id: number;
    email: string;
    name: string;
    phone: string;
    is_admin: number;
    created_at: string;
    ads: number;
    photos: number;
    last_login: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    isAdmin: !!r.is_admin,
    isCredentialRow: isAdminCredentialAccount(r.email),
    createdAt: r.created_at,
    ads: r.ads,
    photos: r.photos,
    lastLoginAt: r.last_login,
  }));
}

/**
 * No I, O, 0 or 1 — this gets read down a phone to a parent who is trying to
 * type it at the same time. 32 characters divides 256 exactly, so taking bytes
 * modulo the alphabet introduces no bias.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function temporaryPassword(): string {
  const chars = Array.from(randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join('')).join('-');
}

/**
 * Replaces an account's password with a fresh one and hands it back — once.
 * Nothing stores the plaintext, so an admin who loses it issues another.
 *
 * Existing sessions are NOT ended: they are signed JWTs, and this app has no
 * revocation list to add them to. A reset locks out whoever knew the old
 * password, but someone already signed in stays signed in until their cookie
 * expires. See src/lib/auth.ts.
 */
export async function resetPassword(userId: number): Promise<string> {
  const password = temporaryPassword();
  db()
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(await hashPassword(password), userId);
  return password;
}
