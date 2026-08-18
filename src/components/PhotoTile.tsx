'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LibraryPhoto } from '@/lib/files';

/** Rough guide before a slot is known: how big a photo is in general terms. */
export function sizeNote(width: number, height: number) {
  const shortest = Math.min(width, height);
  if (shortest >= 1500) return { text: 'Great for any size', cls: 'dpi-good' };
  if (shortest >= 900) return { text: 'Fine for small placements', cls: 'dpi-fair' };
  return { text: 'Small — may print soft', cls: 'dpi-low' };
}

/**
 * One photo in a library grid.
 *
 * Shared by the parent's own library and the boosters' view of it, so the two
 * cannot drift into disagreeing about what a photo is or where it is used.
 * Without `onDelete` the tile is read-only; both libraries pass one.
 *
 * `confirmDelete` puts a step in front of it. The owner clicking Delete on
 * their own photo is unremarkable; an admin doing it to somebody else's is
 * worth a second's pause.
 */
export default function PhotoTile({
  photo,
  onDelete,
  confirmDelete = false,
}: {
  photo: LibraryPhoto;
  onDelete?: (id: number) => void;
  /** Ask before deleting, and say whose photo it is. */
  confirmDelete?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const note = sizeNote(photo.width, photo.height);
  const inUse = photo.usedBy.length > 0;

  return (
    <div className="photo-tile">
      <div style={{ position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.origName} loading="lazy" />
        {/* A thumbnail is too small to carry the tiled watermark legibly, so
            the library says it in words instead. The watermark itself belongs
            on the ad preview, where the photo is big enough to read it. */}
        {photo.rightsManaged && <span className="rights-badge">Rights-managed</span>}
      </div>
      <div className="photo-tile-body">
        <div className="photo-tile-name" title={photo.origName}>
          {photo.origName || 'photo'}
        </div>
        <div className={`photo-tile-meta ${note.cls}`}>
          {photo.width}×{photo.height} · {note.text}
        </div>
        {inUse ? (
          <div className="photo-tile-meta">
            Used in{' '}
            {photo.usedBy.map((u, i) => (
              <span key={`${u.adId}-${u.slot}`}>
                {i > 0 && ', '}
                <Link href={`/ads/${u.adId}`}>{u.playerName.trim() || `ad #${u.adId}`}</Link>
              </span>
            ))}
          </div>
        ) : (
          onDelete &&
          (confirming ? (
            <div className="stack" style={{ gap: 4, marginTop: 6 }}>
              <div className="photo-tile-meta">Delete this photo for good?</div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(photo.id)}>
                  Delete
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-sm btn-danger"
              style={{ marginTop: 6 }}
              onClick={() => (confirmDelete ? setConfirming(true) : onDelete(photo.id))}
            >
              Delete
            </button>
          ))
        )}
      </div>
    </div>
  );
}
