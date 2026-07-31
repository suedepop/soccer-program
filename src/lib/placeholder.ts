import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type Database from 'better-sqlite3';

/**
 * The stand-in photo every library starts with.
 *
 * Media day is usually after the ad deadline, so a parent often wants to build
 * the page before the photo they actually want exists. This gives them
 * something to place in the meantime that is obviously a placeholder — to
 * themselves while building it, and to the boosters if one ever reaches the
 * printer by mistake.
 *
 * It is a real library photo, copied per account rather than shared: deleting a
 * photo unlinks its file, and one parent tidying up must not blank out
 * everybody else's.
 */

/** What the parent sees it called in their library. */
export const PLACEHOLDER_NAME = 'Media Day Photo [Placeholder].png';

/** Committed artwork — see scripts/make-placeholder.mjs. */
function sourceFile(): string {
  return path.join(process.cwd(), 'public', 'placeholder', 'media-day-photo.png');
}

/**
 * Width and height straight out of the PNG's IHDR chunk. Sharp would also
 * answer this, but it is a heavyweight native module and this runs while the
 * database is still opening.
 */
function pngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Copies the placeholder into one account's library. Returns false if it could not. */
export function givePlaceholder(
  conn: Database.Database,
  uploadDir: string,
  userId: number
): boolean {
  const source = sourceFile();
  if (!fs.existsSync(source)) return false;

  const buffer = fs.readFileSync(source);
  const { width, height } = pngSize(buffer);
  const storedName = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(uploadDir, storedName), buffer);

  conn
    .prepare(
      `INSERT INTO files (user_id, stored_name, orig_name, mime, width, height, bytes)
       VALUES (?, ?, ?, 'image/png', ?, ?, ?)`
    )
    .run(userId, storedName, PLACEHOLDER_NAME, width, height, buffer.byteLength);

  // Seeded once and remembered, so a parent who deletes it does not find it
  // back in their library after the next deploy.
  conn.prepare('UPDATE users SET placeholder_seeded = 1 WHERE id = ?').run(userId);
  return true;
}

/** Gives it to every account that has never had one. Returns how many. */
export function seedMissingPlaceholders(conn: Database.Database, uploadDir: string): number {
  const rows = conn
    .prepare('SELECT id FROM users WHERE placeholder_seeded = 0')
    .all() as { id: number }[];

  let done = 0;
  for (const row of rows) {
    if (givePlaceholder(conn, uploadDir, row.id)) done++;
  }
  return done;
}
