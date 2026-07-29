'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SubmitAdButton({
  adId,
  disabled,
  warn,
}: {
  adId: number;
  disabled: boolean;
  /** Non-blocking caution shown in the confirm step (e.g. soft photos). */
  warn?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ads/${adId}/submit`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not submit that ad.');
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="stack">
        {warn && <div className="notice notice-warn">{warn}</div>}
        <div className="notice notice-info">
          Submitting locks nothing yet — you can still edit until the boosters mark it paid. After
          that, email us for changes.
        </div>
        <div className="row">
          <button className="btn" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Yes, submit my ad'}
          </button>
          <button className="btn btn-secondary" onClick={() => setConfirming(false)}>
            Go back
          </button>
        </div>
        {error && <div className="notice notice-bad">{error}</div>}
      </div>
    );
  }

  return (
    <div className="stack">
      <button className="btn btn-lg" disabled={disabled} onClick={() => setConfirming(true)}>
        Submit this ad
      </button>
      {error && <div className="notice notice-bad">{error}</div>}
    </div>
  );
}
