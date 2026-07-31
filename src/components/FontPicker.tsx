'use client';

import { FONT_INHERIT, fontsFor, getFont, resolveFont, type FontRole } from '@/lib/fonts';

/**
 * One big sample of the chosen face, over a row of name buttons.
 *
 * Every option used to carry its own rendered sample, which meant 23 tiles of
 * live type for one decision — accurate, and a wall. The sample only has to be
 * right for the face you are actually considering, and that is one tap away.
 *
 * "Match the background" is folded into whichever font it currently resolves
 * to, rather than shown as its own button. Listing it separately renders the
 * same typeface twice whenever a background's pairing uses a font from this
 * list, which is nearly always, and reads as a bug.
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
  // *this* list, and then the inherited face does need its own button.
  const inheritIsListed = options.some((f) => f.id === defaultFontId);
  const chosen = resolveFont(value, defaultFontId);
  const inheriting = value === FONT_INHERIT;

  return (
    <div>
      <label>{label}</label>
      {hint && (
        <div className="hint" style={{ marginTop: -2, marginBottom: 7 }}>
          {hint}
        </div>
      )}

      <div className="picker-preview">
        {/* The weight the ad will actually use: a name prints in the family's
            heaviest real instance, body copy in its regular. Showing every
            sample at 400 made the heavy display faces look like something they
            never are on the page. */}
        <div
          className="picker-sample"
          style={{
            fontFamily: chosen.stack,
            fontWeight: role === 'name' ? chosen.headingWeight : 400,
          }}
        >
          {sample}
        </div>
      </div>
      <div className="picker-caption">
        <strong>{chosen.name}</strong> — {chosen.blurb}
        {inheriting && <span className="picker-note"> Matches this background.</span>}
      </div>

      <div className="chip-row">
        {/* Reachable whenever a background pairs with a family this list does
            not offer, so the parent can still keep what the design intended. */}
        {!inheritIsListed && (
          <button
            type="button"
            className="chip"
            aria-pressed={inheriting}
            onClick={() => onChange(FONT_INHERIT)}
          >
            {getFont(defaultFontId).name}
            <span className="chip-dot" aria-hidden>
              ●
            </span>
          </button>
        )}

        {options.map((font) => {
          const isBackgroundDefault = inheritIsListed && font.id === defaultFontId;
          // Selecting the background's own font keeps it on "inherit", so the
          // type still follows if the parent picks a different background.
          const selected = isBackgroundDefault
            ? inheriting || value === font.id
            : value === font.id;

          return (
            <button
              key={font.id}
              type="button"
              className="chip"
              aria-pressed={selected}
              title={
                isBackgroundDefault ? `${font.blurb} Matches this background.` : font.blurb
              }
              onClick={() => onChange(isBackgroundDefault ? FONT_INHERIT : font.id)}
            >
              {font.name}
              {isBackgroundDefault && (
                <span className="chip-dot" aria-hidden>
                  ●
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="hint">
        <span className="chip-dot" aria-hidden>
          ●
        </span>{' '}
        pairs with this background.
      </div>
    </div>
  );
}
