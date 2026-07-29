'use client';

import type { Background } from '@/lib/backgrounds';
import { NAME_EFFECTS } from '@/lib/effects';
import type { AdFont } from '@/lib/fonts';

/**
 * Each option previews the effect on the chosen background, in the chosen name
 * font — the effects take their colours from the background, so a swatch on a
 * neutral card would be misleading.
 */
export default function NameEffectPicker({
  value,
  background,
  font,
  sample,
  onChange,
}: {
  value: string;
  background: Background;
  font: AdFont;
  sample: string;
  onChange: (effectId: string) => void;
}) {
  // The tile is ~64px tall; size the sample so the effect reads at a glance.
  const SAMPLE_SIZE = 21;

  return (
    <div>
      <label>Name effect</label>
      <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>
        Applies to the player’s name only — messages stay clean and readable.
      </div>
      <div className="chooser chooser-3">
        {NAME_EFFECTS.map((effect) => (
          <button
            key={effect.id || 'none'}
            type="button"
            className="swatch"
            aria-pressed={value === effect.id}
            title={effect.blurb}
            onClick={() => onChange(effect.id)}
          >
            <div
              className="swatch-body"
              style={{ position: 'relative', overflow: 'hidden', ...background.base }}
            >
              {background.overlay && (
                <div style={{ position: 'absolute', inset: 0, ...background.overlay }} />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '0 4px',
                  color: background.colors.heading,
                  fontFamily: font.stack,
                  fontWeight: font.headingWeight,
                  fontSize: SAMPLE_SIZE,
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  ...effect.style(SAMPLE_SIZE, {
                    heading: background.colors.heading,
                    accent: background.colors.accent,
                    dark: background.dark,
                  }),
                }}
              >
                {sample}
              </div>
            </div>
            <div className="swatch-label">{effect.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
