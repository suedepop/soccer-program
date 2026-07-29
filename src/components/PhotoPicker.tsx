'use client';

import { useEffect, useMemo, useState } from 'react';
import PhotoUploadButton from '@/components/PhotoUploadButton';
import type { LibraryState } from '@/components/usePhotoLibrary';
import { photoQuality, requiredPixels, type Box } from '@/lib/layouts';
import type { AdSize } from '@/lib/config';

/**
 * Library chooser for one photo slot.
 *
 * Every photo is graded against *this* slot rather than in the abstract: the
 * same image can be plenty for a quarter-page inset and far too small for a
 * full-bleed hero, so a single library-wide verdict would mislead.
 */
export default function PhotoPicker({
  library,
  size,
  slot,
  slotIndex,
  currentFileId,
  onSelect,
  onClose,
}: {
  library: LibraryState;
  size: AdSize;
  slot: Box;
  slotIndex: number;
  currentFileId?: number;
  onSelect: (fileId: number) => void;
  onClose: () => void;
}) {
  const [hideSmall, setHideSmall] = useState(false);
  const required = requiredPixels(size, slot);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const graded = useMemo(
    () =>
      library.photos.map((photo) => ({
        photo,
        check: photoQuality(size, slot, photo),
      })),
    [library.photos, size, slot]
  );

  const lowCount = graded.filter((g) => g.check.quality === 'low').length;
  const shown = hideSmall ? graded.filter((g) => g.check.quality !== 'low') : graded;
  const full = library.photos.length >= library.limit;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Choose photo ${slotIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0 }}>Choose photo {slotIndex + 1}</h3>
            <div className="hint" style={{ marginTop: 2 }}>
              This spot wants at least {required.w}×{required.h} pixels ·{' '}
              {library.photos.length} of {library.limit} photos in your library
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-tools">
          {!full && (
            <PhotoUploadButton
              onFiles={library.upload}
              busy={library.uploading}
              disabled={library.uploading}
              label="Upload more"
            />
          )}
          {lowCount > 0 && (
            <label className="row" style={{ gap: 6, margin: 0, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={hideSmall}
                onChange={(e) => setHideSmall(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Hide the {lowCount} too small for this spot
            </label>
          )}
        </div>

        {library.error && <div className="notice notice-warn">{library.error}</div>}

        <div className="modal-body">
          {library.loading ? (
            <p>Loading your photos…</p>
          ) : library.photos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ color: 'var(--muted)' }}>
                Your photo library is empty. Upload a few and they will be available to every ad.
              </p>
            </div>
          ) : (
            <div className="photo-grid photo-grid-picker">
              {shown.map(({ photo, check }) => (
                <button
                  key={photo.id}
                  type="button"
                  className="photo-tile photo-tile-pick"
                  aria-pressed={photo.id === currentFileId}
                  onClick={() => onSelect(photo.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.origName} loading="lazy" />
                  <div className="photo-tile-body">
                    <div className={`photo-tile-meta dpi-${check.quality}`}>
                      {check.quality === 'good' && `✓ Sharp — ${check.effectiveDpi} DPI here`}
                      {check.quality === 'fair' && `⚠ A little soft — ${check.effectiveDpi} DPI`}
                      {check.quality === 'low' && `✕ Too small — ${check.effectiveDpi} DPI`}
                    </div>
                    <div className="photo-tile-name" title={photo.origName}>
                      {photo.width}×{photo.height}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
