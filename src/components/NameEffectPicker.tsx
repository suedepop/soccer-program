'use client';

import BackgroundArt from '@/components/BackgroundArt';
import type { Background } from '@/lib/backgrounds';
import { NAME_EFFECTS, NAME_EFFECT_COLORS, getNameEffect, getNameEffectColor } from '@/lib/effects';
import type { AdFont } from '@/lib/fonts';

/** Big enough for a ring or a halo to read as itself rather than as a smudge. */
const SAMPLE_SIZE = 34;

/**
 * One sample of the name as it will actually print — on this background, in
 * this font, with this effect and colour — over two rows of plain buttons.
 *
 * The sample has to sit on the real background, because that is where the
 * effect gets its colours from; a swatch on a neutral card would be misleading.
 * The colour row appears only once an effect is chosen; "the colour of None" is
 * not a thing anybody needs to decide.
 */
export default function NameEffectPicker({
  value,
  color,
  background,
  font,
  sample,
  onChange,
  onColorChange,
}: {
  value: string;
  color: string;
  background: Background;
  font: AdFont;
  sample: string;
  onChange: (effectId: string) => void;
  onColorChange: (colorId: string) => void;
}) {
  const chosen = getNameEffect(value);
  const ink = getNameEffectColor(color);
  const colors = {
    heading: background.colors.heading,
    accent: background.colors.accent,
    dark: background.dark,
  };

  return (
    <div>
      <label>Name effect</label>
      <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>
        Applies to the player’s name only — messages stay clean and readable.
      </div>

      <div
        className="picker-preview picker-preview-art"
        style={{ position: 'relative', overflow: 'hidden', ...background.base }}
      >
        <BackgroundArt bg={background} />
        <div
          className="picker-sample"
          style={{
            position: 'relative',
            color: background.colors.heading,
            fontFamily: font.stack,
            fontWeight: font.headingWeight,
            fontSize: SAMPLE_SIZE,
            ...chosen.style(SAMPLE_SIZE, colors, ink),
          }}
        >
          {sample}
        </div>
      </div>
      <div className="picker-caption">
        <strong>{chosen.name}</strong> — {chosen.blurb}
      </div>

      <div className="chip-row">
        {NAME_EFFECTS.map((effect) => (
          <button
            key={effect.id || 'none'}
            type="button"
            className="chip"
            aria-pressed={value === effect.id}
            title={effect.blurb}
            onClick={() => onChange(effect.id)}
          >
            {effect.name}
          </button>
        ))}
      </div>

      {value !== '' && (
        <div style={{ marginTop: 12 }}>
          <label>Effect color</label>
          <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>
            Automatic is what this background picks on its own — red outlines and black shadows
            where the lettering is white.
          </div>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              aria-pressed={color === ''}
              onClick={() => onColorChange('')}
            >
              Automatic
            </button>
            {NAME_EFFECT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={color === c.id}
                onClick={() => onColorChange(c.id)}
              >
                <span className="chip-swatch" style={{ background: c.hex }} aria-hidden />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
