'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AdCanvas from '@/components/AdCanvas';
import { AD_SIZES, AD_SIZE_ORDER, formatMoney, type AdSize } from '@/lib/config';
import { layoutsFor } from '@/lib/layouts';

const SAMPLE = {
  playerName: 'Bill Hendricks',
  message:
    'Have a great season, Bill! We can’t wait to cheer you on from the stands. Go Red Riders!',
  attribution: '— Missy, Bill, and Jen',
  photos: [],
  backgroundId: 'classic-white',
};

export default function SizePicker() {
  const router = useRouter();
  const [busy, setBusy] = useState<AdSize | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(size: AdSize) {
    setBusy(size);
    setError(null);
    const res = await fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not start that ad.');
      setBusy(null);
      return;
    }
    router.push(`/ads/${json.id}/edit`);
  }

  return (
    <>
      {error && (
        <div className="notice notice-bad" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <div className="pricing">
        {AD_SIZE_ORDER.map((id) => {
          const spec = AD_SIZES[id];
          const layouts = layoutsFor(id);
          // Scale every sample to the same 190px width so sizes read as shapes.
          const scale = 190 / (spec.widthIn * 96);
          return (
            <div className="card" key={id}>
              <div className="preview-stage">
                <AdCanvas
                  ad={{ ...SAMPLE, size: id, layoutId: layouts[0].id }}
                  scale={scale}
                  showEmptySlots
                />
              </div>
              <div className="spread" style={{ marginTop: 14, alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{spec.label}</h3>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>
                  {formatMoney(spec.priceCents)}
                </div>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>{spec.blurb}</p>
              <ul style={{ fontSize: 13, paddingLeft: 18, color: 'var(--ink-2)' }}>
                <li>
                  {spec.widthIn}&Prime; × {spec.heightIn}&Prime;
                </li>
                <li>
                  Up to {spec.maxPhotos} photo{spec.maxPhotos > 1 ? 's' : ''}
                </li>
                <li>{layouts.length} layouts</li>
              </ul>
              <button className="btn" onClick={() => start(id)} disabled={busy !== null}>
                {busy === id ? 'Starting…' : `Choose ${spec.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
