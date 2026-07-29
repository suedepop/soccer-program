import { requireUser } from '@/lib/auth';
import { AD_SIZES, type AdSize } from '@/lib/config';
import { createAd } from '@/lib/ads';
import { fail, handler, ok } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json()) as Record<string, unknown>;
  const size = String(body.size ?? '') as AdSize;
  if (!AD_SIZES[size]) return fail('Pick a valid ad size.');

  const ad = createAd(user.id, size);
  return ok({ id: ad.id });
});
