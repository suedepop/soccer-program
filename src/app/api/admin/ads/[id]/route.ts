import { requireAdmin } from '@/lib/auth';
import { AD_STATUS, MAX_AD_PRICE_CENTS, formatMoney, type AdStatus } from '@/lib/config';
import { getAd, setAdminNotes, setPrice, setStatus } from '@/lib/ads';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad) return fail('Ad not found.', 404);

  const body = (await req.json()) as Record<string, unknown>;

  if (body.status !== undefined) {
    const status = String(body.status) as AdStatus;
    if (!(status in AD_STATUS)) return fail('Unknown status.');
    setStatus(ad.id, status);
  }
  if (body.adminNotes !== undefined) {
    setAdminNotes(ad.id, String(body.adminNotes));
  }
  // Whole cents only, and genuinely a number. Coercing here would be actively
  // dangerous: JSON has no NaN or Infinity, so a client that computes a bad
  // figure sends `null`, and Number(null) is 0 — a typo in the admin form
  // would silently comp the ad rather than be refused.
  if (body.priceCents !== undefined) {
    const cents = typeof body.priceCents === 'number' ? body.priceCents : Number.NaN;
    if (!Number.isInteger(cents) || cents < 0 || cents > MAX_AD_PRICE_CENTS) {
      return fail(`Price must be a whole number of cents, $0 to ${formatMoney(MAX_AD_PRICE_CENTS)}.`);
    }
    setPrice(ad.id, cents);
  }

  return ok({ ad: getAd(ad.id) });
});
