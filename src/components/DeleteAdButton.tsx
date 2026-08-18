'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Lets a parent throw away one of their own drafts.
 *
 * Only ever rendered for a draft — the API refuses anything further along, and
 * offering a button that comes back with "contact the boosters" would be a
 * worse answer than not offering it. See the DELETE route for why the line sits
 * there.
 *
 * The confirm is an inline step rather than `window.confirm`, to match the way
 * submitting and the admin's delete already ask.
 */
export default function DeleteAdButton({
  adId,
  playerName,
  redirectTo,
}: {
  adId: number;
  playerName: string;
  /** Where to go once it is gone. Without it, the list refreshes in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ads/${adId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Could not delete that ad.');
      setBusy(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    // Nothing to reset either way: the card this sits in is about to stop
    // existing, and on the detail page we are leaving.
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        className="btn btn-sm btn-ghost"
        style={{ color: 'var(--bad)' }}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Delete
      </button>
    );
  }

  return (
    <div className="stack" style={{ gap: 8, width: '100%' }}>
      <div className="notice notice-bad" style={{ fontSize: 12.5 }}>
        Delete <strong>{playerName || 'this draft'}</strong> for good? The wording and the layout
        go with it. Your photos stay in your library.
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={destroy}>
          {busy ? 'Deleting…' : 'Delete this draft'}
        </button>
        <button
          className="btn btn-sm btn-secondary"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Keep it
        </button>
      </div>
      {error && (
        <div className="notice notice-bad" style={{ fontSize: 12.5 }}>
          {error}
        </div>
      )}
    </div>
  );
}
