'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdCanvas from '@/components/AdCanvas';
import FontPicker from '@/components/FontPicker';
import NameEffectPicker from '@/components/NameEffectPicker';
import PhotoPicker from '@/components/PhotoPicker';
import RichTextField from '@/components/RichTextField';
import { useFitScale } from '@/components/useFitScale';
import { usePhotoLibrary } from '@/components/usePhotoLibrary';
import { BACKGROUNDS, getBackground } from '@/lib/backgrounds';
import { getFont, resolveFont } from '@/lib/fonts';
import { getLayout, layoutsFor, photoQuality, requiredPixels } from '@/lib/layouts';
import { stripMarkup } from '@/lib/richtext';
import { AD_SIZES, CSS_DPI, DEFAULT_AD_TEXT, TEAMS, TEXT_LIMITS, formatMoney } from '@/lib/config';
import type { AdView, PhotoRef } from '@/lib/types';

type Tab = 'layout' | 'style' | 'photos' | 'words';

const SAMPLE_TEXT = {
  playerName: 'Kylie Marsh',
  message: 'Keep smiling on and off the field — you are a joy to watch.',
  attribution: 'Love, Mom and Dad',
};

export default function AdEditor({ initialAd }: { initialAd: AdView }) {
  const router = useRouter();
  const [ad, setAd] = useState<AdView>(initialAd);
  const [tab, setTab] = useState<Tab>('layout');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Which slot the library picker is open for, if any. */
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const library = usePhotoLibrary();

  const spec = AD_SIZES[ad.size];
  const layout = getLayout(ad.layoutId, ad.size);
  const background = getBackground(ad.backgroundId);
  const naturalWidth = spec.widthIn * CSS_DPI;
  const { ref: stageRef, scale } = useFitScale(naturalWidth);

  // ------------------------------------------------------------ autosave --

  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return;

    setSaveState('saving');
    const res = await fetch(`/api/ads/${initialAd.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaveState('error');
      setError(json.error ?? 'Could not save that change.');
      return;
    }
    setError(null);
    setSaveState('saved');
    // The server drops photos that the new layout has no slot for.
    if (json.ad) setAd((prev) => ({ ...prev, photos: json.ad.photos }));
  }, [initialAd.id]);

  const queue = useCallback(
    (patch: Partial<AdView>) => {
      setAd((prev) => ({ ...prev, ...patch }));
      Object.assign(pending.current, patch);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush]
  );

  useEffect(() => {
    const onLeave = () => {
      if (Object.keys(pending.current).length) flush();
    };
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  // -------------------------------------------------------------- photos --

  const photosBySlot = useMemo(
    () => new Map(ad.photos.map((p) => [p.slot, p])),
    [ad.photos]
  );

  /** Places a photo from the library into a slot. */
  const assign = useCallback(
    async (slot: number, fileId: number) => {
      setSaveState('saving');
      const res = await fetch(`/api/ads/${initialAd.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, fileId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveState('error');
        setError(json.error ?? 'Could not place that photo.');
        return;
      }
      setError(null);
      setSaveState('saved');
      const p = json.photo;
      const next: PhotoRef = {
        slot,
        fileId: p.fileId,
        url: p.url,
        width: p.width,
        height: p.height,
        origName: p.origName ?? '',
        focalX: 0.5,
        focalY: 0.5,
      };
      setAd((prev) => ({
        ...prev,
        photos: [...prev.photos.filter((x) => x.slot !== slot), next].sort(
          (a, b) => a.slot - b.slot
        ),
      }));
    },
    [initialAd.id]
  );

  const removePhoto = useCallback(
    async (slot: number) => {
      await fetch(`/api/ads/${initialAd.id}/photos?slot=${slot}`, { method: 'DELETE' });
      setAd((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.slot !== slot) }));
    },
    [initialAd.id]
  );

  const setFocal = useCallback(
    async (slot: number, focalX: number, focalY: number) => {
      setAd((prev) => ({
        ...prev,
        photos: prev.photos.map((p) => (p.slot === slot ? { ...p, focalX, focalY } : p)),
      }));
      await fetch(`/api/ads/${initialAd.id}/photos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, focalX, focalY }),
      });
    },
    [initialAd.id]
  );

  // --------------------------------------------------------------- gates --

  const nameSample = stripMarkup(ad.playerName).trim() || 'Kylie Marsh';

  const missingPhotos = layout.photos.filter((_, i) => !photosBySlot.has(i)).length;
  const lowResCount = layout.photos.reduce((n, slot, i) => {
    const photo = photosBySlot.get(i);
    if (!photo) return n;
    return photoQuality(ad.size, slot, photo).quality === 'low' ? n + 1 : n;
  }, 0);

  const ready =
    ad.playerName.trim() && ad.message.trim() && ad.attribution.trim() && missingPhotos === 0;

  return (
    <div className="editor-grid">
      {pickerSlot !== null && (
        <PhotoPicker
          library={library}
          size={ad.size}
          slot={layout.photos[pickerSlot]}
          slotIndex={pickerSlot}
          currentFileId={photosBySlot.get(pickerSlot)?.fileId}
          onSelect={async (fileId) => {
            const slot = pickerSlot;
            setPickerSlot(null);
            await assign(slot, fileId);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {/* ------------------------------------------------------- controls -- */}
      <div>
        <div className="card card-tight" style={{ marginBottom: 14 }}>
          <div className="spread">
            <div>
              <div className="kicker">{spec.label}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {spec.widthIn}&Prime; × {spec.heightIn}&Prime; · {formatMoney(spec.priceCents)}
              </div>
            </div>
            <SaveIndicator state={saveState} />
          </div>
        </div>

        {error && (
          <div className="notice notice-bad" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div className="tabs" role="tablist">
          {(
            [
              ['layout', 'Layout'],
              ['style', 'Style'],
              ['photos', `Photos (${layout.photos.length - missingPhotos}/${layout.photos.length})`],
              ['words', 'Wording'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              className="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'layout' && (
          <div className="chooser chooser-2">
            {layoutsFor(ad.size).map((l) => (
              <button
                key={l.id}
                className="layout-card"
                aria-pressed={ad.layoutId === l.id}
                onClick={() => queue({ layoutId: l.id })}
              >
                <div className="preview-stage" style={{ padding: 6 }}>
                  <AdCanvas
                    ad={{
                      ...ad,
                      layoutId: l.id,
                      playerName: ad.playerName || SAMPLE_TEXT.playerName,
                      message: ad.message || SAMPLE_TEXT.message,
                      attribution: ad.attribution || SAMPLE_TEXT.attribution,
                    }}
                    scale={130 / naturalWidth}
                    showEmptySlots
                  />
                </div>
                <div className="layout-name">{l.name}</div>
                <div className="layout-desc">{l.description}</div>
              </button>
            ))}
          </div>
        )}

        {tab === 'style' && (
          <div className="stack" style={{ gap: 20 }}>
            <div>
              <label>Background</label>
              <div className="chooser chooser-3">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    className="swatch"
                    aria-pressed={ad.backgroundId === bg.id}
                    onClick={() => queue({ backgroundId: bg.id })}
                    title={bg.name}
                  >
                    <div className="swatch-body" style={{ position: 'relative', ...bg.base }}>
                      {bg.overlay && (
                        <div style={{ position: 'absolute', inset: 0, ...bg.overlay }} />
                      )}
                      {bg.frame && <div style={{ position: 'absolute', ...bg.frame }} />}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          placeItems: 'center',
                          color: bg.colors.heading,
                          fontFamily: getFont(bg.fonts.heading).stack,
                          fontWeight: getFont(bg.fonts.heading).headingWeight,
                          fontSize: 15,
                        }}
                      >
                        Aa
                      </div>
                    </div>
                    <div className="swatch-label">{bg.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <FontPicker
              label="Name font"
              hint="Used for the player’s name."
              value={ad.headingFont}
              defaultFontId={background.fonts.heading}
              sample={nameSample}
              onChange={(headingFont) => queue({ headingFont })}
            />

            <NameEffectPicker
              value={ad.nameEffect}
              background={background}
              font={resolveFont(ad.headingFont, background.fonts.heading)}
              sample={nameSample.split(' ')[0] || 'Kylie'}
              onChange={(nameEffect) => queue({ nameEffect })}
            />

            <FontPicker
              label="Message font"
              hint="Used for your message and the “from” line."
              value={ad.bodyFont}
              defaultFontId={background.fonts.body}
              sample="Go Red Riders!"
              onChange={(bodyFont) => queue({ bodyFont })}
            />
          </div>
        )}

        {tab === 'photos' && (
          <div className="slot-list">
            <div className="notice notice-info">
              Photos come from your{' '}
              <Link href="/photos" target="_blank">
                photo library
              </Link>
              . Upload once and use the same picture in as many ads as you like — we check each one
              against the exact spot you drop it in.
            </div>
            {layout.photos.map((slot, i) => (
              <PhotoSlotRow
                key={i}
                index={i}
                slot={slot}
                size={ad.size}
                photo={photosBySlot.get(i)}
                onChoose={() => setPickerSlot(i)}
                onRemove={() => removePhoto(i)}
                onFocal={(x, y) => setFocal(i, x, y)}
              />
            ))}
          </div>
        )}

        {tab === 'words' && (
          <div className="card stack">
            <div>
              <label htmlFor="team">Team</label>
              <select
                id="team"
                value={ad.team}
                onChange={(e) => queue({ team: e.target.value as AdView['team'] })}
              >
                {TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <RichTextField
              id="playerName"
              label="Player name"
              value={ad.playerName}
              maxVisible={TEXT_LIMITS.playerName}
              placeholder="Kylie Marsh"
              sampleValue={DEFAULT_AD_TEXT.playerName}
              onChange={(playerName) => queue({ playerName })}
            />

            <RichTextField
              id="message"
              label="Your message"
              value={ad.message}
              maxVisible={TEXT_LIMITS.message}
              multiline
              minHeight={ad.size === 'quarter' ? 110 : 160}
              placeholder="Kylie, we have loved watching you play over the years and can’t wait to see what the future holds."
              sampleValue={DEFAULT_AD_TEXT.message}
              onChange={(message) => queue({ message })}
              hint="The type shrinks automatically to fit — shorter messages print larger."
            />

            <RichTextField
              id="attribution"
              label="From"
              value={ad.attribution}
              maxVisible={TEXT_LIMITS.attribution}
              placeholder="Love, Mom and Dad"
              sampleValue={DEFAULT_AD_TEXT.attribution}
              onChange={(attribution) => queue({ attribution })}
            />

            <div className="hint">
              Select any words and use <strong>B</strong> / <em>I</em> /{' '}
              <span style={{ textDecoration: 'underline' }}>U</span> above the box — or Ctrl+B,
              Ctrl+I, Ctrl+U. The preview shows exactly how it will print.
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- preview -- */}
      <div className="preview-pane">
        <div className="spread" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Live preview</h3>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Actual size {spec.widthIn}&Prime; × {spec.heightIn}&Prime;
          </span>
        </div>

        <div className="preview-stage" ref={stageRef}>
          <AdCanvas ad={ad} scale={scale} showEmptySlots />
        </div>

        <div className="stack" style={{ marginTop: 14 }}>
          {missingPhotos > 0 && (
            <div className="notice notice-warn">
              {missingPhotos} photo{missingPhotos > 1 ? 's' : ''} still needed for this layout.
            </div>
          )}
          {lowResCount > 0 && (
            <div className="notice notice-warn">
              {lowResCount} photo{lowResCount > 1 ? 's are' : ' is'} below print resolution and will
              look soft or pixelated. Check the Photos tab.
            </div>
          )}
          <div className="row">
            <Link
              className="btn"
              href={`/ads/${ad.id}`}
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                flush();
              }}
            >
              {ready ? 'Preview & Submit' : 'Preview'}
            </Link>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (timer.current) clearTimeout(timer.current);
                await flush();
                router.push('/dashboard');
              }}
            >
              Save &amp; Close
            </button>
          </div>
          {!ready && (
            <div className="hint">
              You can leave and come back — nothing is submitted until you say so.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces --

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const text =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved'
        : state === 'error'
          ? 'Not saved'
          : 'Draft';
  const tone = state === 'error' ? 'badge-bad' : state === 'saved' ? 'badge-ok' : 'badge-muted';
  return <span className={`badge ${tone}`}>{text}</span>;
}

function PhotoSlotRow({
  index,
  slot,
  size,
  photo,
  onChoose,
  onRemove,
  onFocal,
}: {
  index: number;
  slot: ReturnType<typeof getLayout>['photos'][number];
  size: AdView['size'];
  photo?: PhotoRef;
  onChoose: () => void;
  onRemove: () => void;
  onFocal: (x: number, y: number) => void;
}) {
  const required = requiredPixels(size, slot);
  const check = photo ? photoQuality(size, slot, photo) : null;

  return (
    <div className="slot">
      {photo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className="slot-thumb"
          src={photo.url}
          alt=""
          style={{ objectPosition: `${photo.focalX * 100}% ${photo.focalY * 100}%` }}
        />
      ) : (
        <button
          type="button"
          className="slot-thumb slot-empty"
          onClick={onChoose}
          style={{ cursor: 'pointer' }}
        >
          Choose
        </button>
      )}

      <div className="grow">
        <div className="spread" style={{ alignItems: 'baseline' }}>
          <strong style={{ fontSize: 14 }}>Photo {index + 1}</strong>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            wants {required.w}×{required.h}px
          </span>
        </div>

        {check && photo && (
          <div style={{ fontSize: 12.5, marginTop: 3 }} className={`dpi-${check.quality}`}>
            {check.quality === 'good' && (
              <>✓ Sharp — {photo.width}×{photo.height}px, prints at {check.effectiveDpi} DPI.</>
            )}
            {check.quality === 'fair' && (
              <>
                ⚠ A little small — {photo.width}×{photo.height}px prints at about{' '}
                {check.effectiveDpi} DPI. It will print, but softly. A larger file would look
                better.
              </>
            )}
            {check.quality === 'low' && (
              <>
                ✕ Too small for print — {photo.width}×{photo.height}px only reaches{' '}
                {check.effectiveDpi} DPI here. Expect it to look blurry. Try the original from your
                camera roll, or pick a layout with a smaller photo.
              </>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-sm btn-secondary" onClick={onChoose}>
            {photo ? 'Change photo' : 'Choose photo'}
          </button>
          {photo && (
            <button className="btn btn-sm btn-danger" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>

        {photo && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>
              Crop position
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 22px)', gap: 3 }}>
              {[0, 0.5, 1].flatMap((y) =>
                [0, 0.5, 1].map((x) => {
                  const active =
                    Math.abs(photo.focalX - x) < 0.01 && Math.abs(photo.focalY - y) < 0.01;
                  return (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      aria-label={`Focus ${x * 100}% ${y * 100}%`}
                      onClick={() => onFocal(x, y)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        cursor: 'pointer',
                        border: `1px solid ${active ? 'var(--red)' : 'var(--line)'}`,
                        background: active ? 'var(--red-soft)' : '#fff',
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
