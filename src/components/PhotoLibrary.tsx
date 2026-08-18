'use client';

import PhotoTile from '@/components/PhotoTile';
import PhotoUploadButton from '@/components/PhotoUploadButton';
import UploadProgressBar from '@/components/UploadProgressBar';
import { usePhotoLibrary } from '@/components/usePhotoLibrary';
import { PRINT_DPI } from '@/lib/config';

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
          {lib.photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} onDelete={lib.remove} />
          ))}
        </div>
      )}

      <div className="hint">
        For a sharp print we want {PRINT_DPI} DPI. When you place a photo into an ad we check it
        against that exact spot and tell you if it is too small.
      </div>
    </div>
  );
}
