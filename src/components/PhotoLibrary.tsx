'use client';

import Link from 'next/link';
import PhotoUploadButton from '@/components/PhotoUploadButton';
import UploadProgressBar from '@/components/UploadProgressBar';
import { usePhotoLibrary } from '@/components/usePhotoLibrary';
import { PRINT_DPI } from '@/lib/config';

/** Rough guide before a slot is known: how big a photo is in general terms. */
function sizeNote(width: number, height: number) {
  const shortest = Math.min(width, height);
  if (shortest >= 1500) return { text: 'Great for any size', cls: 'dpi-good' };
  if (shortest >= 900) return { text: 'Fine for small placements', cls: 'dpi-fair' };
  return { text: 'Small — may print soft', cls: 'dpi-low' };
}

export default function PhotoLibrary() {
  const lib = usePhotoLibrary();
  const full = lib.photos.length >= lib.limit;

  return (
    <div className="stack">
      <div className="card">
        <div className="spread" style={{ marginBottom: 12 }}>
          <div>
            <strong>
              {lib.photos.length} of {lib.limit} photos
            </strong>
            <div className="hint" style={{ marginTop: 2 }}>
              Upload once, then place them into as many ads as you like.
            </div>
          </div>
          {/* Redundant on a phone, where the green button below is the whole
              point of the screen. It earns its place beside the count on a
              laptop, where the drop zone is the thing underneath. */}
          {!full && (
            <span className="only-wide">
              <PhotoUploadButton onFiles={lib.upload} busy={lib.uploading} label="Add photos" />
            </span>
          )}
        </div>

        {lib.error && <div className="notice notice-warn">{lib.error}</div>}

        {full ? (
          <div className="notice notice-warn">
            Your library is full. Delete a photo you are no longer using to make room.
          </div>
        ) : (
          <PhotoUploadButton
            onFiles={lib.upload}
            busy={lib.uploading}
            disabled={lib.uploading}
            label="Add photos"
            full
          />
        )}

        <UploadProgressBar progress={lib.progress} />
      </div>

      {lib.loading ? (
        <div className="card">Loading your photos…</div>
      ) : lib.photos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <h3>No photos yet</h3>
          <p style={{ color: 'var(--muted)' }}>
            Add the pictures you might want to use. You can pick from them while building any ad.
          </p>
        </div>
      ) : (
        <div className="photo-grid">
          {lib.photos.map((photo) => {
            const note = sizeNote(photo.width, photo.height);
            const inUse = photo.usedBy.length > 0;
            return (
              <div className="photo-tile" key={photo.id}>
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
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ marginTop: 6 }}
                      onClick={() => lib.remove(photo.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hint">
        For a sharp print we want {PRINT_DPI} DPI. When you place a photo into an ad we check it
        against that exact spot and tell you if it is too small.
      </div>
    </div>
  );
}
