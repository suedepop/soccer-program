'use client';

import { useCallback, useMemo, useState } from 'react';
import PhotoTile from '@/components/PhotoTile';
import PhotoUploadButton from '@/components/PhotoUploadButton';
import UploadProgressBar from '@/components/UploadProgressBar';
import { usePhotoLibrary } from '@/components/usePhotoLibrary';

/**
 * One parent's library, from the boosters' side: everything they have, with a
 * way to add and to remove.
 *
 * Deleting somebody else's material is a real thing to hand out, so the tile
 * asks before it does it and the API keeps the guard the owner's own route has:
 * a photo an ad still places cannot be removed, because `ad_photos` cascades
 * and it would come out of that ad silently. The refusal names the ads, which
 * an admin can go and clear themselves.
 */
export default function AdminUserPhotos({
  userId,
  who,
}: {
  userId: number;
  /** Name or email, for sentences that have to say whose library this is. */
  who: string;
}) {
  // A new string every render would re-run the hook's load effect forever.
  const basePath = useMemo(() => `/api/admin/users/${userId}/photos`, [userId]);
  const lib = usePhotoLibrary(basePath);
  const full = lib.photos.length >= lib.limit;

  const [rightsManaged, setRightsManaged] = useState(false);
  const { upload } = lib;
  const send = useCallback(
    (files: File[]) => upload(files, rightsManaged ? { rightsManaged: '1' } : undefined),
    [upload, rightsManaged]
  );

  return (
    <div className="stack">
      <div className="card">
        <div className="spread" style={{ marginBottom: 12 }}>
          <div>
            <strong>
              {lib.photos.length} of {lib.limit} photos
            </strong>
            <div className="hint" style={{ marginTop: 2 }}>
              This is {who}’s own library — anything you add here is theirs to use, and anything
              you delete is gone from it.
            </div>
          </div>
          {!full && (
            <span className="only-wide">
              <PhotoUploadButton
                onFiles={send}
                busy={lib.uploading}
                label="Add photos for them"
              />
            </span>
          )}
        </div>

        {lib.error && <div className="notice notice-warn">{lib.error}</div>}

        {full ? (
          <div className="notice notice-warn">
            This library is full at {lib.limit} photos. Delete one below, or ask {who} to, before
            anything else will fit.
          </div>
        ) : (
          <>
            {/* Above the drop zone, not below it: it changes what the next
                upload becomes, so it has to be read before the files are
                chosen rather than found afterwards. */}
            <label className="rights-toggle">
              <input
                type="checkbox"
                checked={rightsManaged}
                onChange={(e) => setRightsManaged(e.target.checked)}
              />
              <span>
                <strong>Rights-managed</strong>
                <span className="hint">
                  For a photographer’s licensed images. {who} sees these under a watermark while
                  they build the ad; the file that goes to the printer has none.
                </span>
              </span>
            </label>
            <PhotoUploadButton
              onFiles={send}
              busy={lib.uploading}
              disabled={lib.uploading}
              label={rightsManaged ? 'Add rights-managed photos' : 'Add photos for them'}
              full
            />
          </>
        )}

        <UploadProgressBar progress={lib.progress} />
      </div>

      {lib.loading ? (
        <div className="card">Loading {who}’s photos…</div>
      ) : lib.photos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>
          <h3>Nothing in here yet</h3>
          <p style={{ color: 'var(--muted)' }}>
            {who} has not uploaded a photo. If you have their media-day shots, add them above and
            they will be waiting the next time they sign in.
          </p>
        </div>
      ) : (
        <div className="photo-grid">
          {lib.photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} onDelete={lib.remove} confirmDelete />
          ))}
        </div>
      )}
    </div>
  );
}
