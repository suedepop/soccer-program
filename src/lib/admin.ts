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
  /** How many of those photos are licensed. Always <= photos. */
  rightsManagedPhotos: number;
  /** Last successful sign-in, or null if they never have. */
  lastLoginAt: string | null;
}

export function listUsers(): AdminUser[] {
  const rows = db()
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.is_admin, u.created_at,
              (SELECT COUNT(*) FROM ads a WHERE a.user_id = u.id) AS ads,
              (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id) AS photos,
              (SELECT COUNT(*) FROM files f
                WHERE f.user_id = u.id AND f.rights_managed = 1) AS rights_managed,
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
    rights_managed: number;
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
    rightsManagedPhotos: r.rights_managed,
    lastLoginAt: r.last_login,
  }));
}

/** One account's photo library, summarised for the overview screen. */
export interface LibrarySummary {
  userId: number;
  name: string;
  email: string;
  isAdmin: boolean;
  count: number;
  /** Newest first, capped at the preview size the caller asked for. */
  recent: { id: number; url: string; origName: string; width: number; height: number }[];
}

/**
 * Every account's library at a glance, newest account first.
 *
 * Two queries for the whole site rather than two per account: a photo row is
 * small, and the alternative is an N+1 that grows with every family that signs
 * up. Only the preview thumbnails are kept — the full list is one click away
 * and there is no point shipping 100 rows per parent to draw eight of them.
 */
export function listLibraries(preview = 8): LibrarySummary[] {
  const users = db()
    .prepare(
      `SELECT id, email, name, is_admin FROM users
        ORDER BY created_at DESC, id DESC`
    )
    .all() as { id: number; email: string; name: string; is_admin: number }[];

  const files = db()
    .prepare(
      `SELECT id, user_id, orig_name, width, height FROM files
        ORDER BY created_at DESC, id DESC`
    )
    .all() as {
    id: number;
    user_id: number;
    orig_name: string;
    width: number;
    height: number;
  }[];

  const byUser = new Map<number, LibrarySummary['recent']>();
  const counts = new Map<number, number>();
  for (const f of files) {
    counts.set(f.user_id, (counts.get(f.user_id) ?? 0) + 1);
    const list = byUser.get(f.user_id) ?? [];
    if (list.length < preview) {
      list.push({
        id: f.id,
        url: `/api/files/${f.id}`,
        origName: f.orig_name,
        width: f.width,
        height: f.height,
      });
    }
    byUser.set(f.user_id, list);
  }

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    isAdmin: !!u.is_admin,
    count: counts.get(u.id) ?? 0,
    recent: byUser.get(u.id) ?? [],
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
