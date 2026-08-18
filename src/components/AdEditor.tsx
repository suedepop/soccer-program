'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import AdCanvas from '@/components/AdCanvas';
import BackgroundArt from '@/components/BackgroundArt';
import FontPicker from '@/components/FontPicker';
import NameEffectPicker from '@/components/NameEffectPicker';
import PhotoAdjuster from '@/components/PhotoAdjuster';
import PhotoPicker from '@/components/PhotoPicker';
import RichTextField from '@/components/RichTextField';
import SubmitAdButton from '@/components/SubmitAdButton';
import TextSizeControl from '@/components/TextSizeControl';
import { useFitScale } from '@/components/useFitScale';
import { usePhotoLibrary } from '@/components/usePhotoLibrary';
import { validateForSubmit } from '@/lib/adChecks';
import { backgroundsFor, getBackground } from '@/lib/backgrounds';
import { getFont, resolveFont } from '@/lib/fonts';
import { getLayout, layoutsFor, photoQuality, requiredPixels } from '@/lib/layouts';
import { stripMarkup } from '@/lib/richtext';
import { AD_SIZES, CSS_DPI, DEFAULT_AD_TEXT, TEAMS, TEXT_LIMITS, formatMoney } from '@/lib/config';
import type { AdView, PhotoRef } from '@/lib/types';

/**
 * The ad is built one decision at a time, in the order the decisions actually
 * depend on each other: the background sets the palette every later step is
 * previewed against, the layout decides how many photos there are to place, and
 * the wording is written last, when there is a real page to write it into.
 *
 * The steps are a *path*, not a gate — every chip in the stepper is clickable,
 * so a parent who only came back to swap one photo is two taps from it.
 */
type StepId = 'background' | 'layout' | 'photos' | 'words' | 'preview';

const STEPS: { id: StepId; label: string; title: string; blurb: string }[] = [
  {
    id: 'background',
    label: 'Background',
    title: 'Pick a background',
    blurb: 'This sets the colors and the type for everything that follows.',
  },
  {
    id: 'layout',
    label: 'Layout',
    title: 'Pick a layout',
    blurb: 'Where the photos and the words sit. It also decides how many photos you need.',
  },
  {
    id: 'photos',
    label: 'Photos',
    title: 'Place your photos',
    blurb: 'Drop one into each spot, then drag to nudge and zoom to crop.',
  },
  {
    id: 'words',
    label: 'Copy',
    title: 'Write the ad',
    blurb: 'The name, the message, and who it is from — plus the type they are set in.',
  },
  {
    id: 'preview',
    label: 'Preview',
    title: 'Check it over',
    blurb: 'This is exactly how it will print.',
  },
];

/** Which step fixes each blocking problem, so the checklist can send you there. */
const STEP_FOR_FIELD: Record<string, StepId> = {
  playerName: 'words',
  message: 'words',
  attribution: 'words',
  photos: 'photos',
};

const SAMPLE_TEXT = {
  playerName: 'Kylie Marsh',
  message: 'Keep smiling on and off the field — you are a joy to watch.',
  attribution: 'Love, Mom and Dad',
};

export default function AdEditor({
  initialAd,
  libraryOwnerId,
}: {
  initialAd: AdView;
  /**
   * Whose library the picker shows, when that is not the person using it — an
   * admin editing a parent's ad. The photos in an ad have to belong to the ad's
   * owner (`/api/ads/[id]/photos` enforces it), so showing the admin their own
   * library offered them a set where every choice was refused.
   */
  libraryOwnerId?: number;
}) {
  const router = useRouter();
  const [ad, setAd] = useState<AdView>(initialAd);
  const [stepIndex, setStepIndex] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Which slot the library picker is open for, if any. */
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  // A fresh string each render would restart the hook's load effect forever.
  const libraryPath = useMemo(
    () => (libraryOwnerId ? `/api/admin/users/${libraryOwnerId}/photos` : undefined),
    [libraryOwnerId]
  );
  const library = usePhotoLibrary(libraryPath);
  const shellRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);

  const step = STEPS[stepIndex];
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

  /** Everything queued, written now — used when leaving a step or the editor. */
  const flushNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await flush();
  }, [flush]);

  useEffect(() => {
    const onLeave = () => {
      if (Object.keys(pending.current).length) flush();
    };
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      if (timer.current) clearTimeout(timer.current);
      // Leaving by a link is a client-side navigation: no pagehide fires, the
      // editor just unmounts, and a keystroke inside the debounce window would
      // go with it.
      onLeave();
    };
  }, [flush]);

  // ----------------------------------------------------------- stepping --

  /**
   * Keep the current chip on screen. The stepper scrolls sideways on a phone,
   * so without this, moving on to step 4 leaves the highlight off the right
   * edge and the row looks like it never moved.
   * `block: 'nearest'` keeps it from dragging the page up or down as well.
   */
  useEffect(() => {
    chipRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [stepIndex]);

  /**
   * Each move saves first. The Preview step is judged by the server against
   * what it has stored, so arriving there with a debounce still pending would
   * mean being told to fix something already fixed.
   */
  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(STEPS.length - 1, Math.max(0, index));
      void flushNow();
      setStepIndex(next);
      shellRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    [flushNow]
  );

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
        zoom: 1,
        rightsManaged: !!p.rightsManaged,
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

  /**
   * Nudge/zoom applies to local state immediately so dragging stays smooth,
   * and is written back on a short debounce — a drag fires dozens of updates a
   * second and every one of them would otherwise be a round trip.
   */
  const adjustTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adjust = useCallback(
    (slot: number, next: { focalX: number; focalY: number; zoom: number }) => {
      setAd((prev) => ({
        ...prev,
        photos: prev.photos.map((p) => (p.slot === slot ? { ...p, ...next } : p)),
      }));
      if (adjustTimer.current) clearTimeout(adjustTimer.current);
      adjustTimer.current = setTimeout(() => {
        fetch(`/api/ads/${initialAd.id}/photos`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot, ...next }),
        }).catch(() => setError('Could not save the photo position.'));
      }, 250);
    },
    [initialAd.id]
  );

  // --------------------------------------------------------------- gates --

  const nameSample = stripMarkup(ad.playerName).trim() || 'Kylie Marsh';

  const missingPhotos = layout.photos.filter((_, i) => !photosBySlot.has(i)).length;
  const lowResCount = layout.photos.reduce((n, slot, i) => {
    const photo = photosBySlot.get(i);
    if (!photo) return n;
    return photoQuality(ad.size, slot, photo, photo.zoom ?? 1).quality === 'low' ? n + 1 : n;
  }, 0);

  // The same rules the submit route enforces, run against local state so the
  // checklist answers before the round trip.
  const issues = validateForSubmit(ad);
  const stepsNeedingWork = new Set(issues.map((i) => STEP_FOR_FIELD[i.field]));

  const onPreview = step.id === 'preview';

  return (
    <div ref={shellRef}>
      {pickerSlot !== null && (
        <PhotoPicker
          library={library}
          size={ad.size}
          slot={layout.photos[pickerSlot]}
          slotIndex={pickerSlot}
          currentFileId={photosBySlot.get(pickerSlot)?.fileId}
          someoneElses={!!libraryOwnerId}
          onSelect={async (fileId) => {
            const slot = pickerSlot;
            setPickerSlot(null);
            await assign(slot, fileId);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}

      <div className="card card-tight step-head">
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
          <strong>{spec.label}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {' '}
            · {spec.widthIn}&Prime; × {spec.heightIn}&Prime; · {formatMoney(spec.priceCents)}
          </span>
        </div>
        <SaveIndicator state={saveState} status={ad.status} />
      </div>

      {error && (
        <div className="notice notice-bad" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <nav className="stepper" aria-label="Ad steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            ref={i === stepIndex ? chipRef : undefined}
            className={`step-chip${stepsNeedingWork.has(s.id) ? ' needs-work' : ''}`}
            aria-current={i === stepIndex ? 'step' : undefined}
            onClick={() => goTo(i)}
          >
            <span className="step-num">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <div className={`wizard${onPreview ? ' at-preview' : ''}`}>
        {/* ------------------------------------------------------- step -- */}
        <div className="wizard-main">
          <div className="card">
            <div className="kicker">
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <h2 style={{ margin: '2px 0 4px' }}>{step.title}</h2>
            <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
              {step.blurb}
            </p>

            {step.id === 'background' && (
              <div className="chooser chooser-3">
                {backgroundsFor(ad.size).map((bg) => (
                  <button
                    key={bg.id}
                    className="swatch"
                    aria-pressed={ad.backgroundId === bg.id}
                    onClick={() => queue({ backgroundId: bg.id })}
                    title={bg.name}
                  >
                    <div className="swatch-body" style={{ position: 'relative', ...bg.base }}>
                      <BackgroundArt bg={bg} thumb />
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
            )}

            {step.id === 'layout' && (
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

            {step.id === 'photos' && (
              <div className="slot-list">
                {layout.photos.length === 0 ? (
                  <div className="notice notice-info">
                    This layout is all type — there are no photos to place. Carry on to the wording.
                  </div>
                ) : libraryOwnerId ? (
                  <div className="notice notice-info">
                    These come from{' '}
                    <Link href={`/admin/photos/${libraryOwnerId}`} target="_blank">
                      this parent’s photo library
                    </Link>
                    , not yours — an ad can only hold photos its owner has. Anything you upload
                    here lands in their library too.
                  </div>
                ) : (
                  <div className="notice notice-info">
                    Photos come from your{' '}
                    <Link href="/photos" target="_blank">
                      photo library
                    </Link>
                    . Upload once and use the same picture in as many ads as you like — we check
                    each one against the exact spot you drop it in.
                  </div>
                )}
                {layout.photos.map((slot, i) => (
                  <PhotoSlotRow
                    key={i}
                    index={i}
                    slot={slot}
                    size={ad.size}
                    photo={photosBySlot.get(i)}
                    onChoose={() => setPickerSlot(i)}
                    onRemove={() => removePhoto(i)}
                    onAdjust={(next) => adjust(i, next)}
                  />
                ))}
              </div>
            )}

            {step.id === 'words' && (
              <div className="stack" style={{ gap: 16 }}>
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

                <TextSizeControl ad={ad} onChange={(textScale) => queue({ textScale })} />

                <div className="hint">
                  Select any words and use <strong>B</strong> / <em>I</em> /{' '}
                  <span style={{ textDecoration: 'underline' }}>U</span> above the box — or Ctrl+B,
                  Ctrl+I, Ctrl+U. The preview shows exactly how it will print.
                </div>

                {/* The type lives with the words rather than with the background:
                    a font is only worth judging against the name you actually
                    typed, and by now it is typed. */}
                <div className="step-divider">Type &amp; effects</div>

                <FontPicker
                  label="Name font"
                  hint="Used for the player’s name."
                  role="name"
                  value={ad.headingFont}
                  defaultFontId={background.fonts.heading}
                  sample={nameSample}
                  onChange={(headingFont) => queue({ headingFont })}
                />

                <NameEffectPicker
                  value={ad.nameEffect}
                  color={ad.nameEffectColor}
                  background={background}
                  font={resolveFont(ad.headingFont, background.fonts.heading)}
                  sample={nameSample}
                  onChange={(nameEffect) => queue({ nameEffect })}
                  onColorChange={(nameEffectColor) => queue({ nameEffectColor })}
                />

                <FontPicker
                  label="Message font"
                  hint="Used for your message and the “from” line."
                  role="message"
                  value={ad.bodyFont}
                  defaultFontId={background.fonts.body}
                  sample="Go Red Riders!"
                  onChange={(bodyFont) => queue({ bodyFont })}
                />
              </div>
            )}

            {step.id === 'preview' && (
              <div className="stack">
                {ad.status === 'draft' ? (
                  issues.length > 0 ? (
                    <>
                      <div className="notice notice-warn">
                        <strong>A couple of things first</strong>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                          {issues.map((i) => (
                            <li key={i.field + i.message}>
                              {i.message}{' '}
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() =>
                                  goTo(STEPS.findIndex((s) => s.id === STEP_FOR_FIELD[i.field]))
                                }
                              >
                                Fix it
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button className="btn btn-lg" disabled>
                        Submit this ad
                      </button>
                    </>
                  ) : (
                    <SubmitAdButton
                      adId={ad.id}
                      disabled={false}
                      beforeSubmit={flushNow}
                      onSubmitted={() => router.push(`/ads/${ad.id}`)}
                      warn={
                        lowResCount
                          ? `${lowResCount} photo${lowResCount > 1 ? 's are' : ' is'} below 300 DPI and may print soft. You can still submit — or go back and swap in a larger file.`
                          : undefined
                      }
                    />
                  )
                ) : (
                  <div className="notice notice-ok">
                    This ad is already submitted. Changes still save, right up until the boosters
                    mark it paid. <Link href={`/ads/${ad.id}`}>Payment details</Link>.
                  </div>
                )}

                {/* Save & Close sits in the step bar below, in the slot the
                    Next button occupies on every other step. Repeating it here
                    would be two buttons doing one thing. */}
                <div className="hint">
                  Nothing is charged here — the boosters collect payment off the website. You can
                  leave and come back; every change is already saved.
                </div>
              </div>
            )}
          </div>

          <nav className="step-nav">
            <button
              className="btn btn-secondary"
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === 0}
            >
              ← Back
            </button>
            {onPreview ? (
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  await flushNow();
                  router.push('/dashboard');
                }}
              >
                Save &amp; Close
              </button>
            ) : (
              <button className="btn" onClick={() => goTo(stepIndex + 1)}>
                Next: {STEPS[stepIndex + 1].label} →
              </button>
            )}
          </nav>
        </div>

        {/* ---------------------------------------------------- preview -- */}
        <aside className="wizard-preview">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Live preview</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {spec.widthIn}&Prime; × {spec.heightIn}&Prime;
            </span>
          </div>

          <div
            className="preview-stage stage-cap"
            ref={stageRef}
            style={{ '--ad-aspect': spec.widthIn / spec.heightIn } as CSSProperties}
          >
            <AdCanvas ad={ad} scale={scale} showEmptySlots />
          </div>

          {(missingPhotos > 0 || lowResCount > 0) && (
            <div className="stack" style={{ marginTop: 10, gap: 8 }}>
              {missingPhotos > 0 && (
                <div className="notice notice-warn">
                  {missingPhotos} photo{missingPhotos > 1 ? 's' : ''} still needed for this layout.
                </div>
              )}
              {lowResCount > 0 && (
                <div className="notice notice-warn">
                  {lowResCount} photo{lowResCount > 1 ? 's are' : ' is'} below print resolution and
                  will look soft or pixelated.
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces --

function SaveIndicator({
  state,
  status,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  /** Before anything is edited the badge shows where the ad stands, not "Draft"
      unconditionally — an already-submitted ad reopened for a tweak is not one. */
  status: AdView['status'];
}) {
  const text =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved'
        : state === 'error'
          ? 'Not saved'
          : status === 'draft'
            ? 'Draft'
            : 'Submitted';
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
  onAdjust,
}: {
  index: number;
  slot: ReturnType<typeof getLayout>['photos'][number];
  size: AdView['size'];
  photo?: PhotoRef;
  onChoose: () => void;
  onRemove: () => void;
  onAdjust: (next: { focalX: number; focalY: number; zoom: number }) => void;
}) {
  const required = requiredPixels(size, slot);
  // Grade at the current zoom — cropping in spends resolution.
  const check = photo ? photoQuality(size, slot, photo, photo.zoom ?? 1) : null;

  return (
    <div className="slot">
      {photo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        /* A plain "which photo is this" thumbnail. It deliberately does not
           apply the crop — it is square and the slot usually is not, so it
           could only ever be a near-miss. The adjuster below shows the real
           crop at the slot's true shape. */
        <img className="slot-thumb" src={photo.url} alt="" />
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
          <div style={{ marginTop: 12 }}>
            <PhotoAdjuster photo={photo} size={size} slot={slot} onChange={onAdjust} />
          </div>
        )}
      </div>
    </div>
  );
}
