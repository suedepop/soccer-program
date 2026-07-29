import { requireUser } from '@/lib/auth';
import { getAd, setStatus, validateForSubmit } from '@/lib/ads';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status !== 'draft') return ok({ ok: true, status: ad.status });

  const issues = validateForSubmit(ad);
  if (issues.length) return fail(issues.map((i) => i.message).join(' '), 422);

  setStatus(ad.id, 'submitted');
  return ok({ ok: true, status: 'submitted' });
});
