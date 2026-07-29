import 'server-only';
import { db, now } from './db';
import {
  AD_SIZES,
  DEFAULT_AD_TEXT,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  STORAGE_LIMITS,
  type AdSize,
  type AdStatus,
  type TeamId,
} from './config';

/** Keeps a stored size request inside the range the editor offers. */
function clampTextScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, value));
}
import { clampPan, clampZoom, defaultLayoutId, getLayout } from './layouts';
import { DEFAULT_BACKGROUND_ID, getBackground } from './backgrounds';
import { isNameEffectId } from './effects';
import { isFontId } from './fonts';
import { stripMarkup } from './richtext';
import type { AdView, AdWithOwner, PhotoRef } from './types';

interface AdRow {
  id: number;
  user_id: number;
  size: string;
  layout_id: string;
  background_id: string;
  team: string;
  player_name: string;
  message: string;
  attribution: string;
  heading_font: string;
  body_font: string;
  name_effect: string;
  text_scale: number;
  status: string;
  price_cents: number;
  admin_notes: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  paid_at: string | null;
}

interface PhotoRow {
  slot: number;
  file_id: number;
  focal_x: number;
  focal_y: number;
  zoom: number;
  width: number;
  height: number;
  orig_name: string;
}

function photosFor(adId: number): PhotoRef[] {
  const rows = db()
    .prepare(
      `SELECT p.slot, p.file_id, p.focal_x, p.focal_y, p.zoom,
              f.width, f.height, f.orig_name
         FROM ad_photos p JOIN files f ON f.id = p.file_id
        WHERE p.ad_id = ? ORDER BY p.slot`
    )
    .all(adId) as PhotoRow[];

  return rows.map((r) => ({
    slot: r.slot,
    fileId: r.file_id,
    url: `/api/files/${r.file_id}`,
    width: r.width,
    height: r.height,
    origName: r.orig_name,
    focalX: r.focal_x,
    focalY: r.focal_y,
    zoom: r.zoom ?? 1,
  }));
}

function toView(row: AdRow): AdView {
  return {
    id: row.id,
    userId: row.user_id,
    size: row.size as AdSize,
    layoutId: row.layout_id,
    backgroundId: row.background_id,
    team: row.team as TeamId,
    playerName: row.player_name,
    message: row.message,
    attribution: row.attribution,
    headingFont: row.heading_font ?? '',
    bodyFont: row.body_font ?? '',
    nameEffect: row.name_effect ?? '',
    textScale: clampTextScale(row.text_scale ?? 1),
    status: row.status as AdStatus,
    priceCents: row.price_cents,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at,
    photos: photosFor(row.id),
  };
}

export function createAd(userId: number, size: AdSize): AdView {
  const spec = AD_SIZES[size];
  const info = db()
    .prepare(
      `INSERT INTO ads (user_id, size, layout_id, background_id, price_cents,
                        player_name, message, attribution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      size,
      defaultLayoutId(size),
      DEFAULT_BACKGROUND_ID,
      spec.priceCents,
      DEFAULT_AD_TEXT.playerName,
      DEFAULT_AD_TEXT.message,
      DEFAULT_AD_TEXT.attribution
    );
  return getAd(Number(info.lastInsertRowid))!;
}

export function getAd(id: number): AdView | null {
  const row = db().prepare('SELECT * FROM ads WHERE id = ?').get(id) as AdRow | undefined;
  return row ? toView(row) : null;
}

export function listAdsForUser(userId: number): AdView[] {
  const rows = db()
    .prepare('SELECT * FROM ads WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as AdRow[];
  return rows.map(toView);
}

export function listAllAds(filter?: { status?: AdStatus; size?: AdSize }): AdWithOwner[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (filter?.status) {
    where.push('a.status = ?');
    args.push(filter.status);
  }
  if (filter?.size) {
    where.push('a.size = ?');
    args.push(filter.size);
  }
  const sql = `SELECT a.*, u.email AS owner_email, u.name AS owner_name, u.phone AS owner_phone
                 FROM ads a JOIN users u ON u.id = a.user_id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY CASE a.status WHEN 'submitted' THEN 0 WHEN 'paid' THEN 1
                                       WHEN 'draft' THEN 2 ELSE 3 END,
                         a.created_at DESC`;
  const rows = db().prepare(sql).all(...args) as (AdRow & {
    owner_email: string;
    owner_name: string;
    owner_phone: string;
  })[];
  return rows.map((r) => ({
    ...toView(r),
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
  }));
}

export interface AdPatch {
  layoutId?: string;
  backgroundId?: string;
  team?: TeamId;
  playerName?: string;
  message?: string;
  attribution?: string;
  /** '' clears the override and falls back to the background's pairing. */
  headingFont?: string;
  bodyFont?: string;
  /** '' means no effect. */
  nameEffect?: string;
  textScale?: number;
}

export function updateAd(id: number, patch: AdPatch): AdView | null {
  const existing = getAd(id);
  if (!existing) return null;

  const layoutId =
    patch.layoutId !== undefined
      ? getLayout(patch.layoutId, existing.size).id
      : existing.layoutId;
  const backgroundId =
    patch.backgroundId !== undefined
      ? getBackground(patch.backgroundId).id
      : existing.backgroundId;

  const clip = (s: string | undefined, max: number, fallback: string) =>
    s === undefined ? fallback : s.slice(0, max);

  // '' is meaningful (inherit from the background), so only a known id or the
  // empty string is accepted — anything else keeps the current value.
  const font = (s: string | undefined, fallback: string) =>
    s === undefined ? fallback : s === '' || isFontId(s) ? s : fallback;

  const effect =
    patch.nameEffect === undefined || !isNameEffectId(patch.nameEffect)
      ? existing.nameEffect
      : patch.nameEffect;

  db()
    .prepare(
      `UPDATE ads SET layout_id = ?, background_id = ?, team = ?, player_name = ?,
                      message = ?, attribution = ?, heading_font = ?, body_font = ?,
                      name_effect = ?, text_scale = ?, updated_at = ?
        WHERE id = ?`
    )
    .run(
      layoutId,
      backgroundId,
      patch.team ?? existing.team,
      clip(patch.playerName, STORAGE_LIMITS.playerName, existing.playerName),
      clip(patch.message, STORAGE_LIMITS.message, existing.message),
      clip(patch.attribution, STORAGE_LIMITS.attribution, existing.attribution),
      font(patch.headingFont, existing.headingFont),
      font(patch.bodyFont, existing.bodyFont),
      effect,
      patch.textScale === undefined
        ? existing.textScale
        : clampTextScale(Number(patch.textScale)),
      now(),
      id
    );

  // Layout changes can orphan photos in slots the new layout does not have.
  const slots = getLayout(layoutId, existing.size).photos.length;
  db().prepare('DELETE FROM ad_photos WHERE ad_id = ? AND slot >= ?').run(id, slots);

  return getAd(id);
}

export function setPhoto(adId: number, slot: number, fileId: number | null) {
  if (fileId === null) {
    db().prepare('DELETE FROM ad_photos WHERE ad_id = ? AND slot = ?').run(adId, slot);
  } else {
    db()
      .prepare(
        `INSERT INTO ad_photos (ad_id, slot, file_id) VALUES (?, ?, ?)
         ON CONFLICT(ad_id, slot) DO UPDATE SET file_id = excluded.file_id`
      )
      .run(adId, slot, fileId);
  }
  db().prepare('UPDATE ads SET updated_at = ? WHERE id = ?').run(now(), adId);
}

/**
 * Stores how a photo sits in its slot.
 *
 * Values are clamped here as well as in the UI: pan outside 0..1 or zoom below
 * 1 would let the image pull away from an edge and show the background through
 * the gap, and this is the last point before it reaches the print renderer.
 */
export function setPhotoTransform(
  adId: number,
  slot: number,
  x: number,
  y: number,
  zoom: number
) {
  db()
    .prepare(
      'UPDATE ad_photos SET focal_x = ?, focal_y = ?, zoom = ? WHERE ad_id = ? AND slot = ?'
    )
    .run(clampPan(x), clampPan(y), clampZoom(zoom), adId, slot);
  db().prepare('UPDATE ads SET updated_at = ? WHERE id = ?').run(now(), adId);
}

export function setStatus(id: number, status: AdStatus) {
  const stamp = now();
  const submitted = status === 'submitted' ? stamp : null;
  const paid = status === 'paid' ? stamp : null;
  db()
    .prepare(
      `UPDATE ads
          SET status = ?,
              submitted_at = COALESCE(submitted_at, ?),
              paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, ?) ELSE NULL END,
              updated_at = ?
        WHERE id = ?`
    )
    .run(status, submitted, status, paid, stamp, id);
}

export function setAdminNotes(id: number, notes: string) {
  db()
    .prepare('UPDATE ads SET admin_notes = ?, updated_at = ? WHERE id = ?')
    .run(notes.slice(0, 2000), now(), id);
}

export function deleteAd(id: number) {
  db().prepare('DELETE FROM ads WHERE id = ?').run(id);
}

/** Ads that belong in the printed book, in the order they should be laid out. */
export function printableAds(): AdWithOwner[] {
  return listAllAds().filter((a) => a.status === 'paid' || a.status === 'submitted');
}

export interface AdIssue {
  field: string;
  message: string;
}

/** Blocking problems that stop an ad from being submitted. */
export function validateForSubmit(ad: AdView): AdIssue[] {
  const issues: AdIssue[] = [];
  const layout = getLayout(ad.layoutId, ad.size);

  // Strip markup first — a field holding only formatting marks is still empty.
  const name = stripMarkup(ad.playerName).trim();
  const message = stripMarkup(ad.message).trim();

  // New ads ship with sample text so the preview is not an empty frame, which
  // means "not empty" is no longer proof that anyone wrote anything. Refuse the
  // two fields whose defaults could only ever be placeholder.
  //
  // The default attribution ("- All of us at work") is deliberately NOT checked:
  // it is a phrase a business or a group of coworkers might genuinely mean, and
  // blocking it would nag people who are already finished.
  if (!name) {
    issues.push({ field: 'playerName', message: 'Add the player’s name.' });
  } else if (name === DEFAULT_AD_TEXT.playerName) {
    issues.push({
      field: 'playerName',
      message: `Replace “${DEFAULT_AD_TEXT.playerName}” with the player’s actual name.`,
    });
  }

  if (!message) {
    issues.push({ field: 'message', message: 'Add your message.' });
  } else if (message === stripMarkup(DEFAULT_AD_TEXT.message).trim()) {
    issues.push({
      field: 'message',
      message: 'Replace the sample “Lorem ipsum” text with your own message.',
    });
  }
  if (!stripMarkup(ad.attribution).trim()) {
    issues.push({ field: 'attribution', message: 'Add who the ad is from (e.g. “Love, Mom and Dad”).' });
  }
  const filled = new Set(ad.photos.map((p) => p.slot));
  const missing = layout.photos.map((_, i) => i).filter((i) => !filled.has(i));
  if (missing.length) {
    issues.push({
      field: 'photos',
      message:
        missing.length === layout.photos.length
          ? 'Upload a photo for this layout.'
          : `Photo ${missing.map((i) => i + 1).join(' and ')} still needs an image.`,
    });
  }
  return issues;
}
