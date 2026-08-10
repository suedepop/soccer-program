'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AD_SIZES,
  MAX_AD_PRICE_CENTS,
  formatMoney,
  type AdSize,
  type AdStatus,
} from '@/lib/config';

/**
 * What one ad costs, editable in place.
 *
 * The stored price and the current price list are shown as separate facts
 * rather than reconciled, because a gap between them is usually deliberate —
 * an ad quoted before a change, a comped sponsor — and the booster is the one
 * who knows which. "Use list price" is offered, never applied on its own.
 */
export default function AdminPrice({
  adId,
  size,
  priceCents,
  status,
}: {
  adId: number;
  size: AdSize;
  priceCents: number;
  status: AdStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState((priceCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listCents = AD_SIZES[size].priceCents;
  const offList = priceCents !== listCents;

  async function save(cents: number) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/ads/${adId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceCents: cents }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Could not save that price.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  function submit() {
    const raw = dollars.replace(/[$,\s]/g, '');
    // Empty is its own case, and an important one: Number('') is 0, so a
    // cleared box would otherwise read as "this ad is free" rather than as the
    // slip it almost certainly is. $0 stays reachable by typing it.
    if (raw === '') {
      setError('Enter an amount like 50 or 47.50.');
      return;
    }
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError('Enter an amount like 50 or 47.50.');
      return;
    }
    if (cents > MAX_AD_PRICE_CENTS) {
      setError(`That is over the ${formatMoney(MAX_AD_PRICE_CENTS)} limit.`);
      return;
    }
    save(cents);
  }

  function cancel() {
    setDollars((priceCents / 100).toFixed(2));
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        {formatMoney(priceCents)}{' '}
        <button
          className="btn btn-sm btn-ghost"
          style={{ padding: '0 4px', fontSize: 12 }}
          onClick={() => setOpen(true)}
        >
          edit
        </button>
        {offList && <div style={{ fontSize: 11.5 }}>list {formatMoney(listCents)}</div>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 5, minWidth: 150 }}>
      <div className="row" style={{ gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 13 }}>$</span>
        <input
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') cancel();
          }}
          inputMode="decimal"
          autoFocus
          aria-label="Price in dollars"
          style={{ width: 68, fontSize: 13, padding: '4px 6px' }}
        />
        <button className="btn btn-sm" disabled={busy} onClick={submit}>
          Save
        </button>
        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={cancel}>
          Cancel
        </button>
      </div>

      {status === 'paid' && (
        <div style={{ fontSize: 11.5, color: 'var(--warn)' }}>
          Marked paid — this changes what the books say was collected.
        </div>
      )}

      {Math.round(Number(dollars.replace(/[$,\s]/g, '')) * 100) !== listCents && (
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          list price {formatMoney(listCents)} ·{' '}
          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '0 4px', fontSize: 11.5 }}
            disabled={busy}
            onClick={() => setDollars((listCents / 100).toFixed(2))}
          >
            use list price
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: 11.5, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
