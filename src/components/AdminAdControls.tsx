'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AD_STATUS, type AdStatus } from '@/lib/config';

export default function AdminAdControls({
  adId,
  status,
  notes,
}: {
  adId: number;
  status: AdStatus;
  notes: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [open, setOpen] = useState(false);

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
        <a className="btn btn-sm btn-secondary" href={`/api/admin/ads/${adId}/png`}>
          Print PNG
        </a>
        <a className="btn btn-sm btn-ghost" href={`/print/ad/${adId}`} target="_blank" rel="noreferrer">
          Open
        </a>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide notes' : notes ? 'Notes •' : 'Notes'}
        </button>
      </div>

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
