import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { db, UPLOAD_DIR } from './db';

/** Big enough for a full-bleed 8.5x11 at 300 DPI (2550x3300) with headroom. */
const MAX_DIMENSION = 4500;
const MAX_BYTES = 25 * 1024 * 1024;

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export interface StoredFile {
  id: number;
  width: number;
  height: number;
  mime: string;
  origName: string;
  bytes: number;
}

export class UploadError extends Error {}

export async function storeUpload(userId: number, file: File): Promise<StoredFile> {
  if (file.size > MAX_BYTES) {
    throw new UploadError('That image is larger than 25 MB. Please pick a smaller file.');
  }
  if (file.type && !ACCEPTED.has(file.type)) {
    throw new UploadError('Please upload a JPG, PNG, or WEBP image.');
  }

  const input = Buffer.from(await file.arrayBuffer());

  let pipeline: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    pipeline = sharp(input, { failOn: 'none' });
    meta = await pipeline.metadata();
  } catch {
    throw new UploadError('We could not read that image. Try re-saving it as a JPG.');
  }
  if (!meta.width || !meta.height) {
    throw new UploadError('We could not read that image. Try re-saving it as a JPG.');
  }

  // `.rotate()` bakes in EXIF orientation so the preview and the print render
  // agree — phones almost always ship a rotation flag.
  let out = sharp(input, { failOn: 'none' }).rotate();
  if (Math.max(meta.width, meta.height) > MAX_DIMENSION) {
    out = out.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const keepPng = meta.format === 'png' && (meta.channels ?? 3) === 4;
  const ext = keepPng ? 'png' : 'jpg';
  const buffer = keepPng
    ? await out.png({ compressionLevel: 8 }).toBuffer()
    : await out.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();

  const finalMeta = await sharp(buffer).metadata();
  const storedName = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const mime = keepPng ? 'image/png' : 'image/jpeg';
  const info = db()
    .prepare(
      `INSERT INTO files (user_id, stored_name, orig_name, mime, width, height, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      storedName,
      (file.name || 'photo').slice(0, 200),
      mime,
      finalMeta.width ?? 0,
      finalMeta.height ?? 0,
      buffer.byteLength
    );

  return {
    id: Number(info.lastInsertRowid),
    width: finalMeta.width ?? 0,
    height: finalMeta.height ?? 0,
    mime,
    origName: file.name,
    bytes: buffer.byteLength,
  };
}

/** One image in a parent's library, ready to drop into any ad. */
export interface LibraryPhoto {
  id: number;
  url: string;
  width: number;
  height: number;
  origName: string;
  bytes: number;
  createdAt: string;
  /** Ads currently placing this photo. Deleting is blocked while non-empty. */
  usedBy: PhotoUsage[];
}

export interface PhotoUsage {
  adId: number;
  slot: number;
  playerName: string;
  status: string;
}

export function countPhotos(userId: number): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS n FROM files WHERE user_id = ?')
    .get(userId) as { n: number };
  return row.n;
}

export function listPhotos(userId: number): LibraryPhoto[] {
  const rows = db()
    .prepare(
      `SELECT id, orig_name, width, height, bytes, created_at
         FROM files WHERE user_id = ? ORDER BY created_at DESC, id DESC`
    )
    .all(userId) as {
    id: number;
    orig_name: string;
    width: number;
    height: number;
    bytes: number;
    created_at: string;
  }[];

  // One query for every placement, rather than one per photo.
  const usage = db()
    .prepare(
      `SELECT p.file_id, p.slot, a.id AS ad_id, a.player_name, a.status
         FROM ad_photos p
         JOIN ads a ON a.id = p.ad_id
        WHERE a.user_id = ?`
    )
    .all(userId) as {
    file_id: number;
    slot: number;
    ad_id: number;
    player_name: string;
    status: string;
  }[];

  const byFile = new Map<number, PhotoUsage[]>();
  for (const u of usage) {
    const list = byFile.get(u.file_id) ?? [];
    list.push({ adId: u.ad_id, slot: u.slot, playerName: u.player_name, status: u.status });
    byFile.set(u.file_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    url: `/api/files/${r.id}`,
    width: r.width,
    height: r.height,
    origName: r.orig_name,
    bytes: r.bytes,
    createdAt: r.created_at,
    usedBy: byFile.get(r.id) ?? [],
  }));
}

/** Which of this user's ads place the given photo. */
export function photoUsage(userId: number, fileId: number): PhotoUsage[] {
  return db()
    .prepare(
      `SELECT p.slot, a.id AS adId, a.player_name AS playerName, a.status
         FROM ad_photos p
         JOIN ads a ON a.id = p.ad_id
        WHERE p.file_id = ? AND a.user_id = ?`
    )
    .all(fileId, userId) as PhotoUsage[];
}

/**
 * Removes a photo from the library and from disk.
 *
 * ad_photos cascades on delete, so an in-use photo would silently disappear
 * out of finished ads. Callers must check {@link photoUsage} first — this
 * refuses rather than trusting them.
 */
export async function deletePhoto(userId: number, fileId: number): Promise<boolean> {
  const row = getFileRow(fileId);
  if (!row || row.user_id !== userId) return false;
  if (photoUsage(userId, fileId).length) return false;

  db().prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(fileId, userId);
  await fs.rm(filePath(row), { force: true });
  return true;
}

export interface FileRow {
  id: number;
  user_id: number;
  stored_name: string;
  orig_name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}

export function getFileRow(id: number): FileRow | null {
  return (
    (db().prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined) ?? null
  );
}

export function filePath(row: FileRow): string {
  return path.join(UPLOAD_DIR, row.stored_name);
}
