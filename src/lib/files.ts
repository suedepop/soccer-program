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
