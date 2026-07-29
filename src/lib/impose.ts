import type { AdView } from './types';

/**
 * Imposition: pack ordered ads onto 8.5x11 sheets.
 *
 * A page holds two half-page slots. Each half slot takes one half-page ad or
 * two quarter-page ads side by side. Full pages get a sheet to themselves.
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

export function imposeSheets(ads: AdView[]): Sheet[] {
  const fulls = ads.filter((a) => a.size === 'full');
  const halves = ads.filter((a) => a.size === 'half');
  const quarters = ads.filter((a) => a.size === 'quarter');

  const sheets: Sheet[] = fulls.map((ad) => [{ ad, x: 0, y: 0, w: 100, h: 100 }]);

  const halfQueue = [...halves];
  const quarterQueue = [...quarters];

  while (halfQueue.length || quarterQueue.length) {
    const sheet: Sheet = [];
    for (const top of [true, false]) {
      const y = top ? 0 : 50;
      if (halfQueue.length) {
        sheet.push({ ad: halfQueue.shift()!, x: 0, y, w: 100, h: 50 });
      } else if (quarterQueue.length) {
        sheet.push({ ad: quarterQueue.shift()!, x: 0, y, w: 50, h: 50 });
        if (quarterQueue.length) {
          sheet.push({ ad: quarterQueue.shift()!, x: 50, y, w: 50, h: 50 });
        }
      }
    }
    if (!sheet.length) break;
    sheets.push(sheet);
  }

  return sheets;
}
