'use client';

import Link from 'next/link';
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
 * Without `onDelete` the tile is read-only — which is the admin's view, since
 * an admin may add to a library but not empty one.
 */
export default function PhotoTile({
  photo,
  onDelete,
}: {
  photo: LibraryPhoto;
  onDelete?: (id: number) => void;
}) {
  const note = sizeNote(photo.width, photo.height);
  const inUse = photo.usedBy.length > 0;

  return (
    <div className="photo-tile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.origName} loading="lazy" />
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
          onDelete && (
            <button
              className="btn btn-sm btn-danger"
              style={{ marginTop: 6 }}
              onClick={() => onDelete(photo.id)}
            >
              Delete
            </button>
          )
        )}
      </div>
    </div>
  );
}
