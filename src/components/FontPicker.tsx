'use client';

import { FONTS, FONT_INHERIT, getFont } from '@/lib/fonts';

/**
 * Font chooser. Every option renders in its own face, so the sample IS the
 * decision — the same files the print renderer will use.
 */
export default function FontPicker({
  label,
  hint,
  value,
  defaultFontId,
  sample,
  onChange,
}: {
  label: string;
  hint?: string;
  /** '' means "follow the background". */
  value: string;
  /** What the current background pairs with, shown on the inherit option. */
  defaultFontId: string;
  sample: string;
  onChange: (fontId: string) => void;
}) {
  const inherited = getFont(defaultFontId);

  return (
    <div>
      <label>{label}</label>
      {hint && <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>{hint}</div>}
      <div className="font-grid">
        <button
          type="button"
          className="font-option"
          aria-pressed={value === FONT_INHERIT}
          onClick={() => onChange(FONT_INHERIT)}
        >
          <div className="font-sample" style={{ fontFamily: inherited.stack }}>
            {sample}
          </div>
          <div className="font-meta">Match the background — {inherited.name}</div>
        </button>

        {FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            className="font-option"
            aria-pressed={value === font.id}
            onClick={() => onChange(font.id)}
          >
            <div className="font-sample" style={{ fontFamily: font.stack }}>
              {sample}
            </div>
            <div className="font-meta">
              {font.name} — {font.blurb}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
