import { getBackground } from './backgrounds';
import type { AdView } from './types';

/**
 * Imposition: pack ordered ads onto 8.5x11 sheets.
 *
 * A page holds two half-page bands. Each band takes one half-page ad or two
 * quarter-page ads side by side. Full pages get a sheet to themselves.
 *
 * Beyond fitting, this tries to make the printed book look composed rather than
 * sorted:
 *
 *  - **Half pages are paired with quarters first.** Draining the halves before
 *    touching the quarters — the obvious order — leaves every remaining quarter
 *    to be tiled four to a sheet, which reads as a grid of small boxes. Mixing
 *    them keeps four-up sheets to whatever the ad mix genuinely forces.
 *  - **Similar ads are kept apart.** Two ads sharing a background, a colour
 *    family, or a layout look like a mistake when they land side by side, so
 *    each slot takes the least-similar ad still waiting.
 *
 * The result is deterministic — same ads in, same sheets out. That matters more
 * than it looks: the assembled PDF and the per-sheet PNG downloads impose
 * independently, so anything order-dependent would make "page 3" mean two
 * different things.
 */

export interface Placement {
  ad: AdView;
  /** Percent of the sheet. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Sheet = Placement[];

/**
 * How much each kind of repetition counts against a candidate.
 *
 * The gaps are wide on purpose. Two ads on the same background read as a
 * duplicate and are much worse than two that merely share a colour family, so
 * the weights are near-lexicographic: no realistic pile of tone clashes should
 * ever outvote a single repeated background.
 */
const SAME_BACKGROUND = 20;
const SAME_LAYOUT = 8;
const SAME_TONE = 2;
/** A page turn separates them, so it matters less than sharing a sheet. */
const PREVIOUS_SHEET = 0.4;
/** Candidates considered per slot. Keeps this linear on large programs. */
const LOOKAHEAD = 16;

interface Neighbour {
  ad: AdView;
  weight: number;
}

function similarity(a: AdView, b: AdView): number {
  let score = 0;
  if (a.backgroundId === b.backgroundId) {
    score += SAME_BACKGROUND;
  } else if (getBackground(a.backgroundId).tone === getBackground(b.backgroundId).tone) {
    score += SAME_TONE;
  }
  if (a.layoutId === b.layoutId) score += SAME_LAYOUT;
  return score;
}

/**
 * Removes and returns the queued ad that clashes least with its neighbours.
 * Ties go to the earliest still queued, which keeps submission order roughly
 * intact and keeps the whole thing deterministic.
 */
function take(queue: AdView[], neighbours: Neighbour[]): AdView {
  const limit = Math.min(queue.length, LOOKAHEAD);
  let bestIndex = 0;
  let bestScore = Infinity;

  for (let i = 0; i < limit; i++) {
    let score = 0;
    for (const n of neighbours) score += similarity(queue[i], n.ad) * n.weight;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return queue.splice(bestIndex, 1)[0];
}

export function imposeSheets(ads: AdView[]): Sheet[] {
  const sheets: Sheet[] = [];
  let previous: AdView[] = [];

  const emit = (sheet: Sheet) => {
    if (!sheet.length) return;
    sheets.push(sheet);
    previous = sheet.map((p) => p.ad);
  };

  /** Everything already on this sheet, plus the sheet before it. */
  const context = (sheet: Sheet): Neighbour[] => [
    ...sheet.map((p) => ({ ad: p.ad, weight: 1 })),
    ...previous.map((ad) => ({ ad, weight: PREVIOUS_SHEET })),
  ];

  const fulls = ads.filter((a) => a.size === 'full');
  const halves = ads.filter((a) => a.size === 'half');
  const quarters = ads.filter((a) => a.size === 'quarter');

  // Full pages: one per sheet, ordered so consecutive pages differ.
  while (fulls.length) {
    const sheet: Sheet = [];
    sheet.push({ ad: take(fulls, context(sheet)), x: 0, y: 0, w: 100, h: 100 });
    emit(sheet);
  }

  // Mixed sheets: one half-page band, one band of two quarters. Alternating
  // which band holds the half stops every mixed page looking the same.
  let halfOnTop = true;
  while (halves.length && quarters.length) {
    const sheet: Sheet = [];
    const halfY = halfOnTop ? 0 : 50;
    const quarterY = halfOnTop ? 50 : 0;

    sheet.push({ ad: take(halves, context(sheet)), x: 0, y: halfY, w: 100, h: 50 });
    sheet.push({ ad: take(quarters, context(sheet)), x: 0, y: quarterY, w: 50, h: 50 });
    if (quarters.length) {
      sheet.push({ ad: take(quarters, context(sheet)), x: 50, y: quarterY, w: 50, h: 50 });
    }

    halfOnTop = !halfOnTop;
    emit(sheet);
  }

  // Halves that had no quarter to pair with: two per sheet.
  while (halves.length) {
    const sheet: Sheet = [];
    for (const y of [0, 50]) {
      if (!halves.length) break;
      sheet.push({ ad: take(halves, context(sheet)), x: 0, y, w: 100, h: 50 });
    }
    emit(sheet);
  }

  // Quarters with no halves left. Four to a sheet is the only alternative to
  // leaving half of it blank, which would inflate the page count and the print
  // bill — so it is a fallback rather than the default.
  const QUARTER_SLOTS = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 50 },
  ];
  while (quarters.length) {
    const sheet: Sheet = [];
    for (const pos of QUARTER_SLOTS) {
      if (!quarters.length) break;
      sheet.push({ ad: take(quarters, context(sheet)), ...pos, w: 50, h: 50 });
    }
    emit(sheet);
  }

  refine(sheets);
  return sheets;
}

function sheetCost(sheet: Sheet): number {
  let cost = 0;
  for (let i = 0; i < sheet.length; i++) {
    for (let j = i + 1; j < sheet.length; j++) {
      cost += similarity(sheet[i].ad, sheet[j].ad);
    }
  }
  return cost;
}

function turnCost(a: Sheet, b: Sheet): number {
  let cost = 0;
  for (const pa of a) for (const pb of b) cost += similarity(pa.ad, pb.ad) * PREVIOUS_SHEET;
  return cost;
}

/**
 * Cost of the given sheets plus their page turns — everything a swap between
 * them can affect.
 *
 * Each turn is counted once even when both sheets are in the set. Summing two
 * independent neighbourhoods instead would double-count the turn between
 * adjacent sheets, over-weighting it enough to wave through swaps that make
 * the book worse overall.
 */
function costAround(sheets: Sheet[], indices: number[]): number {
  let cost = 0;
  const countedTurns = new Set<number>();

  for (const i of indices) {
    cost += sheetCost(sheets[i]);
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= sheets.length) continue;
      const first = Math.min(i, j);
      if (countedTurns.has(first)) continue;
      countedTurns.add(first);
      cost += turnCost(sheets[first], sheets[first + 1]);
    }
  }
  return cost;
}

/**
 * Cleans up after the greedy pass by swapping ads between sheets.
 *
 * Filling slots one at a time is short-sighted: the first ad on a sheet is
 * chosen before anything is known about what will join it, so a pairing that
 * looked fine can turn out badly once the sheet fills up. Swapping two
 * same-size ads never changes the geometry, so the packing stays valid while
 * the arrangement improves.
 *
 * Strictly-better swaps only, so it always terminates, and a fixed iteration
 * order keeps the result deterministic.
 */
function refine(sheets: Sheet[], maxPasses = 4): void {
  const slots: { sheet: number; index: number }[] = [];
  sheets.forEach((sheet, si) => sheet.forEach((_, i) => slots.push({ sheet: si, index: i })));

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let a = 0; a < slots.length; a++) {
      for (let b = a + 1; b < slots.length; b++) {
        const A = slots[a];
        const B = slots[b];
        if (A.sheet === B.sheet) continue;

        const pa = sheets[A.sheet][A.index];
        const pb = sheets[B.sheet][B.index];
        if (pa.ad.size !== pb.ad.size) continue;

        const affected = [A.sheet, B.sheet];
        const before = costAround(sheets, affected);
        const adA = pa.ad;
        const adB = pb.ad;
        pa.ad = adB;
        pb.ad = adA;
        const after = costAround(sheets, affected);

        if (after < before) {
          improved = true;
        } else {
          pa.ad = adA;
          pb.ad = adB;
        }
      }
    }

    if (!improved) break;
  }
}

/** Sheets tiled with four quarter-page ads — the layout we try to avoid. */
export function fourUpSheetCount(sheets: Sheet[]): number {
  return sheets.filter((s) => s.filter((p) => p.w === 50 && p.h === 50).length === 4).length;
}

/** Placements that sit on a sheet beside something that looks like them. */
export function adjacencyClashes(sheets: Sheet[]): number {
  let clashes = 0;
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.length; i++) {
      for (let j = i + 1; j < sheet.length; j++) {
        if (sheet[i].ad.backgroundId === sheet[j].ad.backgroundId) clashes++;
      }
    }
  }
  return clashes;
}
