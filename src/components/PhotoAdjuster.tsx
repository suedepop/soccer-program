'use client';

import { useCallback, useRef, useState } from 'react';
import { AD_SIZES, MAX_PHOTO_ZOOM, MIN_PHOTO_ZOOM, type AdSize } from '@/lib/config';
import { clampPan, clampZoom, placePhoto, photoQuality, type PhotoSlot } from '@/lib/layouts';
import type { PhotoRef } from '@/lib/types';

const PREVIEW_W = 240;
/** Arrow-key step, as a fraction of the available travel. */
const NUDGE = 0.04;

/**
 * Drag-to-nudge and zoom for one photo, previewed at the slot's real aspect
 * ratio.
 *
 * Pan is stored as 0..1 of the *available overhang* rather than as pixels, so
 * the picture cannot be pushed away from an edge: at 0 the left edge is flush,
 * at 1 the right edge is, and every value between just redistributes the same
 * overhang. Zoom is floored at 1 (exactly covering the slot). Together those
 * two constraints make an out-of-bounds crop unrepresentable rather than merely
 * discouraged — see placePhoto.
 */
export default function PhotoAdjuster({
  photo,
  size,
  slot,
  onChange,
}: {
  photo: PhotoRef;
  size: AdSize;
  slot: PhotoSlot;
  onChange: (next: { focalX: number; focalY: number; zoom: number }) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, fx: 0.5, fy: 0.5 });

  const zoom = clampZoom(photo.zoom ?? 1);
  const focalX = clampPan(photo.focalX);
  const focalY = clampPan(photo.focalY);

  // The slot's true aspect: its percentage of the page, times the page shape.
  const spec = AD_SIZES[size];
  const previewH = Math.round(
    PREVIEW_W * ((slot.h * spec.heightIn) / (slot.w * spec.widthIn))
  );

  // Lay the preview out in its own pixel space; the maths is identical to the
  // canvas, just at a different scale.
  const place = placePhoto(
    PREVIEW_W,
    previewH,
    photo.width,
    photo.height,
    focalX,
    focalY,
    zoom
  );
  const overhangX = Math.max(0, place.drawW - PREVIEW_W);
  const overhangY = Math.max(0, place.drawH - previewH);

  const check = photoQuality(size, slot, photo, zoom);

  const move = useCallback(
    (dx: number, dy: number) => {
      // No overhang on an axis means there is nothing to pan along it.
      const nextX = overhangX > 0 ? clampPan(start.current.fx - dx / overhangX) : focalX;
      const nextY = overhangY > 0 ? clampPan(start.current.fy - dy / overhangY) : focalY;
      onChange({ focalX: nextX, focalY: nextY, zoom });
    },
    [overhangX, overhangY, focalX, focalY, zoom, onChange]
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (overhangX <= 0 && overhangY <= 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, fx: focalX, fy: focalY };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    e.preventDefault();
    move(e.clientX - start.current.x, e.clientY - start.current.y);
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-NUDGE, 0],
      ArrowRight: [NUDGE, 0],
      ArrowUp: [0, -NUDGE],
      ArrowDown: [0, NUDGE],
    };
    const delta = step[e.key];
    if (!delta) return;
    e.preventDefault();
    onChange({
      focalX: clampPan(focalX + delta[0]),
      focalY: clampPan(focalY + delta[1]),
      zoom,
    });
  }

  const canPan = overhangX > 0 || overhangY > 0;

  return (
    <div className="adjuster">
      <div
        className={`adjuster-frame${dragging ? ' is-dragging' : ''}`}
        style={{
          width: PREVIEW_W,
          height: previewH,
          borderRadius: slot.shape === 'circle' ? '50%' : 6,
          cursor: canPan ? (dragging ? 'grabbing' : 'grab') : 'default',
        }}
        role="application"
        tabIndex={0}
        aria-label="Drag to reposition the photo, or use the arrow keys"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            width: place.drawW,
            height: place.drawH,
            left: place.left,
            top: place.top,
            maxWidth: 'none',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div className="adjuster-controls">
        <label htmlFor={`zoom-${photo.slot}`} style={{ marginBottom: 2 }}>
          Zoom · {zoom.toFixed(2)}×
        </label>
        <input
          id={`zoom-${photo.slot}`}
          type="range"
          min={MIN_PHOTO_ZOOM}
          max={MAX_PHOTO_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) =>
            onChange({ focalX, focalY, zoom: clampZoom(Number(e.target.value)) })
          }
        />

        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onChange({ focalX, focalY, zoom: clampZoom(zoom - 0.15) })}
            disabled={zoom <= MIN_PHOTO_ZOOM}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onChange({ focalX, focalY, zoom: clampZoom(zoom + 0.15) })}
            disabled={zoom >= MAX_PHOTO_ZOOM}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => onChange({ focalX: 0.5, focalY: 0.5, zoom: 1 })}
            disabled={zoom === 1 && focalX === 0.5 && focalY === 0.5}
          >
            Reset
          </button>
        </div>

        <div className={`hint dpi-${check.quality}`} style={{ marginTop: 6 }}>
          {check.quality === 'good' && `Sharp — prints at ${check.effectiveDpi} DPI`}
          {check.quality === 'fair' && `A little soft — ${check.effectiveDpi} DPI`}
          {check.quality === 'low' && `Too small — ${check.effectiveDpi} DPI`}
          {zoom > 1 && ' at this zoom'}
        </div>

        <div className="hint" style={{ marginTop: 2 }}>
          {canPan ? 'Drag the picture to nudge it, or use the arrow keys.' : 'Zoom in to reposition.'}
        </div>
      </div>
    </div>
  );
}
