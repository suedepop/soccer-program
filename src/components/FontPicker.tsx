'use client';

import { FONT_INHERIT, fontsFor, getFont, type FontRole } from '@/lib/fonts';

/**
 * Font chooser. Every option renders in its own face, so the sample IS the
 * decision — the same files the print renderer will use.
 *
 * "Match the background" is folded into whichever font it currently resolves
 * to, rather than shown as its own tile. Listing it separately renders the same
 * typeface twice whenever a background's pairing uses a font from this list,
 * which is nearly always, and reads as a bug.
 */
export default function FontPicker({
  label,
  hint,
  role,
  value,
  defaultFontId,
  sample,
  onChange,
}: {
  label: string;
  hint?: string;
  /** Which list to offer — names and messages want different families. */
  role: FontRole;
  /** '' means "follow the background". */
  value: string;
  /** What the current background pairs with. */
  defaultFontId: string;
  sample: string;
  onChange: (fontId: string) => void;
}) {
  const options = fontsFor(role);
  // Not isFontId: a family can be in the catalogue and still be absent from
  // *this* list, and then the inherited face does need its own tile.
  const inheritIsListed = options.some((f) => f.id === defaultFontId);

  return (
    <div>
      <label>{label}</label>
      {hint && <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>{hint}</div>}
      <div className="font-grid">
        {/* Reachable whenever a background pairs with a family this list does
            not offer, so the parent can still keep what the design intended. */}
        {!inheritIsListed && (
          <button
            type="button"
            className="font-option"
            aria-pressed={value === FONT_INHERIT}
            onClick={() => onChange(FONT_INHERIT)}
          >
            <div className="font-sample" style={{ fontFamily: getFont(defaultFontId).stack }}>
              {sample}
            </div>
            <div className="font-meta">Match the background</div>
          </button>
        )}

        {options.map((font) => {
          const isBackgroundDefault = inheritIsListed && font.id === defaultFontId;
          // Selecting the background's own font keeps it on "inherit", so the
          // type still follows if the parent picks a different background.
          const selected = isBackgroundDefault
            ? value === FONT_INHERIT || value === font.id
            : value === font.id;

          return (
            <button
              key={font.id}
              type="button"
              className="font-option"
              aria-pressed={selected}
              onClick={() => onChange(isBackgroundDefault ? FONT_INHERIT : font.id)}
            >
              <div className="font-sample" style={{ fontFamily: font.stack }}>
                {sample}
              </div>
              <div className="font-meta">
                {font.name} — {font.blurb}
                {isBackgroundDefault && (
                  <>
                    <br />
                    <span className="font-default-note">Matches this background</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
