'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SubmitAdButton({
  adId,
  disabled,
  warn,
  label = 'Submit this ad',
  beforeSubmit,
  onSubmitted,
}: {
  adId: number;
  disabled: boolean;
  /** Non-blocking caution shown in the confirm step (e.g. soft photos). */
  warn?: string;
  label?: string;
  /**
   * Run before the POST. The editor uses it to flush whatever the autosave
   * debounce is still holding — the server validates what it has stored, so an
   * unsaved last edit would otherwise be judged, and printed, as absent.
   */
  beforeSubmit?: () => Promise<void> | void;
  /** Where to go once it lands. Defaults to refreshing the current page. */
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    if (beforeSubmit) await beforeSubmit();
    const res = await fetch(`/api/ads/${adId}/submit`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not submit that ad.');
      setBusy(false);
      return;
    }
    if (onSubmitted) onSubmitted();
    else router.refresh();
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
        {label}
      </button>
      {error && <div className="notice notice-bad">{error}</div>}
    </div>
  );
}
