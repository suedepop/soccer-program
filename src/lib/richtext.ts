/**
 * A deliberately tiny inline-markup format for ad copy.
 *
 *   **bold**   *italic*   __underline__
 *
 * Parents never type these — the B / I / U buttons in the editor wrap the
 * selection for them (src/components/RichTextField.tsx). Storing markup in a
 * plain TEXT column rather than HTML means there is nothing to sanitise: the
 * parser below emits styled spans, never markup, so a message can't inject
 * anything into the page or into the print render.
 *
 * Anything unmatched stays literal, so older plain-text ads keep rendering
 * exactly as they did.
 */

export const MARK_BOLD = 1;
export const MARK_ITALIC = 2;
export const MARK_UNDERLINE = 4;

export interface Run {
  text: string;
  marks: number;
}

export type MarkName = 'b' | 'i' | 'u';

export const TOKENS: Record<MarkName, string> = {
  b: '**',
  i: '*',
  u: '__',
};

const BITS: Record<MarkName, number> = {
  b: MARK_BOLD,
  i: MARK_ITALIC,
  u: MARK_UNDERLINE,
};

// Longest first: '**' has to win over '*', and '__' is checked before it could
// ever be mistaken for a literal underscore.
const RULES: { token: string; bit: number }[] = [
  { token: '**', bit: MARK_BOLD },
  { token: '__', bit: MARK_UNDERLINE },
  { token: '*', bit: MARK_ITALIC },
];

function scan(src: string, marks: number): Run[] {
  const out: Run[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      out.push({ text: buf, marks });
      buf = '';
    }
  };

  while (i < src.length) {
    const rule = RULES.find((r) => !(marks & r.bit) && src.startsWith(r.token, i));
    if (rule) {
      const from = i + rule.token.length;
      const close = src.indexOf(rule.token, from);
      // Require non-empty content, otherwise treat the token as literal text.
      if (close > from) {
        flush();
        out.push(...scan(src.slice(from, close), marks | rule.bit));
        i = close + rule.token.length;
        continue;
      }
    }
    buf += src[i];
    i += 1;
  }

  flush();
  return out;
}

export function parseRich(src: string): Run[] {
  if (!src) return [];
  return scan(src, 0);
}

/** The visible text with all markup removed — for length checks and fitting. */
export function stripMarkup(src: string): string {
  return parseRich(src)
    .map((r) => r.text)
    .join('');
}

/** Fraction of the visible characters that are bold. Feeds the width estimate. */
export function boldFraction(src: string): number {
  const runs = parseRich(src);
  let total = 0;
  let bold = 0;
  for (const r of runs) {
    total += r.text.length;
    if (r.marks & MARK_BOLD) bold += r.text.length;
  }
  return total ? bold / total : 0;
}

/**
 * Wraps or unwraps `[start, end)` of `value` with a mark's token.
 * Returns the new string plus the selection to restore. Used by the toolbar.
 */
export function toggleMark(
  value: string,
  start: number,
  end: number,
  mark: MarkName
): { value: string; start: number; end: number } {
  const token = TOKENS[mark];
  const len = token.length;
  const selected = value.slice(start, end);

  // Already wrapped from just outside the selection — unwrap.
  if (value.slice(start - len, start) === token && value.slice(end, end + len) === token) {
    return {
      value: value.slice(0, start - len) + selected + value.slice(end + len),
      start: start - len,
      end: end - len,
    };
  }

  // Already wrapped inside the selection — unwrap.
  if (selected.startsWith(token) && selected.endsWith(token) && selected.length > len * 2) {
    const inner = selected.slice(len, -len);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      start,
      end: start + inner.length,
    };
  }

  return {
    value: value.slice(0, start) + token + selected + token + value.slice(end),
    start: start + len,
    end: end + len,
  };
}
