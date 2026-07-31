'use client';

import type { UploadProgress } from '@/components/usePhotoLibrary';

/**
 * What an upload is doing, in two honest halves.
 *
 * The bar tracks bytes leaving the phone, which is the slow part on a stadium
 * connection. Once they have all left there is no number left to report — the
 * server is still decoding and resizing each file — so the bar fills and
 * pulses rather than sitting at 99% pretending to know.
 */
export default function UploadProgressBar({ progress }: { progress: UploadProgress | null }) {
  if (!progress) return null;

  const { files, fraction, processing } = progress;
  const percent = Math.round(fraction * 100);
  const plural = files === 1 ? 'photo' : 'photos';

  return (
    <div className="upload-progress">
      <div className="spread" style={{ fontSize: 13, marginBottom: 5 }}>
        <strong>
          {processing ? `Finishing ${files} ${plural}…` : `Uploading ${files} ${plural}…`}
        </strong>
        <span style={{ color: 'var(--muted)' }}>{processing ? 'Almost there' : `${percent}%`}</span>
      </div>
      <div
        className={`upload-bar${processing ? ' is-processing' : ''}`}
        role="progressbar"
        aria-label={`Uploading ${files} ${plural}`}
        aria-valuemin={0}
        aria-valuemax={100}
        // Indeterminate once the bytes are sent: no value, so a screen reader
        // says "busy" instead of announcing a number that has stopped moving.
        aria-valuenow={processing ? undefined : percent}
      >
        <span style={{ width: `${Math.max(3, percent)}%` }} />
      </div>
    </div>
  );
}
