'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AD_STATUS, formatMoney, type AdStatus } from '@/lib/config';

export default function AdminAdControls({
  adId,
  status,
  notes,
  playerName,
  priceCents,
}: {
  adId: number;
  status: AdStatus;
  notes: string;
  playerName: string;
  priceCents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/ads/${adId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

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
    // The row this component lives in is about to stop existing, so there is
    // nothing to reset — refresh and let it go.
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        {status !== 'paid' && (
          <button className="btn btn-sm" disabled={busy} onClick={() => patch({ status: 'paid' })}>
            Mark Paid
          </button>
        )}
        {status === 'paid' && (
          <button
            className="btn btn-sm btn-secondary"
            disabled={busy}
            onClick={() => patch({ status: 'submitted' })}
          >
            Undo Paid
          </button>
        )}
        <select
          value={status}
          disabled={busy}
          onChange={(e) => patch({ status: e.target.value })}
          style={{ width: 'auto', fontSize: 13, padding: '5px 8px' }}
          aria-label="Ad status"
        >
          {Object.values(AD_STATUS).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <a className="btn btn-sm btn-secondary" href={`/ads/${adId}/edit`}>
          Edit
        </a>
        <a className="btn btn-sm btn-secondary" href={`/api/admin/ads/${adId}/png`}>
          Print PNG
        </a>
        <a className="btn btn-sm btn-ghost" href={`/print/ad/${adId}`} target="_blank" rel="noreferrer">
          Open
        </a>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide notes' : notes ? 'Notes •' : 'Notes'}
        </button>
        {!confirmingDelete && (
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--bad)' }}
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirmingDelete(true);
            }}
          >
            Delete
          </button>
        )}
      </div>

      {confirmingDelete && (
        <div className="notice notice-bad" style={{ fontSize: 12.5 }}>
          Delete <strong>{playerName || 'this ad'}</strong> for good? The ad and its layout go;
          the photos stay in the parent’s library.
          {status === 'paid' && (
            <div style={{ marginTop: 6 }}>
              It is marked <strong>Paid</strong>, so the {formatMoney(priceCents)} it contributes
              to your collected total goes too. <strong>Cancelled</strong> keeps the record and
              can be undone — this cannot.
            </div>
          )}
          <div className="row" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={destroy}>
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
            {status !== 'cancelled' && (
              <button
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(false);
                  patch({ status: 'cancelled' });
                }}
              >
                Cancel it instead
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="notice notice-bad" style={{ fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {open && (
        <div>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            style={{ minHeight: 70, fontSize: 13 }}
            placeholder="Check #1042, dropped off 9/3…"
          />
          <button
            className="btn btn-sm"
            style={{ marginTop: 6 }}
            disabled={busy}
            onClick={() => patch({ adminNotes: draftNotes })}
          >
            Save note
          </button>
        </div>
      )}
    </div>
  );
}
