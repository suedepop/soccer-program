/**
 * The "is this ad finished?" rules, kept out of `src/lib/ads.ts` because that
 * module is `server-only` and these have to run in the browser too: the editor's
 * Preview step shows the same checklist the submit route enforces, and a second
 * hand-written copy of the rules would drift the day either one changed.
 */
import { DEFAULT_AD_TEXT } from './config';
import { getLayout } from './layouts';
import { stripMarkup } from './richtext';
import type { AdView } from './types';

export interface AdIssue {
  /** Field name, used to send the parent to the step that fixes it. */
  field: 'playerName' | 'message' | 'attribution' | 'photos';
  message: string;
}

/** Blocking problems that stop an ad from being submitted. */
export function validateForSubmit(ad: AdView): AdIssue[] {
  const issues: AdIssue[] = [];
  const layout = getLayout(ad.layoutId, ad.size);

  // Strip markup first — a field holding only formatting marks is still empty.
  const name = stripMarkup(ad.playerName).trim();
  const message = stripMarkup(ad.message).trim();

  // New ads ship with sample text so the preview is not an empty frame, which
  // means "not empty" is no longer proof that anyone wrote anything. Refuse the
  // two fields whose defaults could only ever be placeholder.
  //
  // The default attribution ("- All of us at work") is deliberately NOT checked:
  // it is a phrase a business or a group of coworkers might genuinely mean, and
  // blocking it would nag people who are already finished.
  if (!name) {
    issues.push({ field: 'playerName', message: 'Add the player’s name.' });
  } else if (name === DEFAULT_AD_TEXT.playerName) {
    issues.push({
      field: 'playerName',
      message: `Replace “${DEFAULT_AD_TEXT.playerName}” with the player’s actual name.`,
    });
  }

  if (!message) {
    issues.push({ field: 'message', message: 'Add your message.' });
  } else if (message === stripMarkup(DEFAULT_AD_TEXT.message).trim()) {
    issues.push({
      field: 'message',
      message: 'Replace the sample “Lorem ipsum” text with your own message.',
    });
  }
  if (!stripMarkup(ad.attribution).trim()) {
    issues.push({ field: 'attribution', message: 'Add who the ad is from (e.g. “Love, Mom and Dad”).' });
  }
  const filled = new Set(ad.photos.map((p) => p.slot));
  const missing = layout.photos.map((_, i) => i).filter((i) => !filled.has(i));
  if (missing.length) {
    issues.push({
      field: 'photos',
      message:
        missing.length === layout.photos.length
          ? 'Upload a photo for this layout.'
          : `Photo ${missing.map((i) => i + 1).join(' and ')} still needs an image.`,
    });
  }
  return issues;
}
