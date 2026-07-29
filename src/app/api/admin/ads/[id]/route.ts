import { requireAdmin } from '@/lib/auth';
import { AD_STATUS, type AdStatus } from '@/lib/config';
import { getAd, setAdminNotes, setStatus } from '@/lib/ads';
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

  return ok({ ad: getAd(ad.id) });
});
