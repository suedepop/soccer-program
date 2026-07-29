import { requireUser } from '@/lib/auth';
import { deleteAd, getAd, updateAd } from '@/lib/ads';
import { TEAMS, type TeamId } from '@/lib/config';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

async function ownedAd(id: number) {
  const user = await requireUser();
  const ad = getAd(id);
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return null;
  return ad;
}

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const ad = await ownedAd(Number(id));
  if (!ad) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') {
    return fail('This ad is locked. Contact the boosters if you need a change.', 409);
  }

  const body = (await req.json()) as Record<string, unknown>;
  const team = body.team === undefined ? undefined : (String(body.team) as TeamId);
  if (team && !TEAMS.some((t) => t.id === team)) return fail('Pick a valid team.');

  const updated = updateAd(ad.id, {
    layoutId: body.layoutId === undefined ? undefined : String(body.layoutId),
    backgroundId: body.backgroundId === undefined ? undefined : String(body.backgroundId),
    team,
    playerName: body.playerName === undefined ? undefined : String(body.playerName),
    message: body.message === undefined ? undefined : String(body.message),
    attribution: body.attribution === undefined ? undefined : String(body.attribution),
    headingFont: body.headingFont === undefined ? undefined : String(body.headingFont),
    bodyFont: body.bodyFont === undefined ? undefined : String(body.bodyFont),
    nameEffect: body.nameEffect === undefined ? undefined : String(body.nameEffect),
    textScale: body.textScale === undefined ? undefined : Number(body.textScale),
  });

  return ok({ ad: updated });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const ad = await ownedAd(Number(id));
  if (!ad) return fail('Ad not found.', 404);
  if (ad.status === 'paid') return fail('Paid ads cannot be deleted.', 409);
  deleteAd(ad.id);
  return ok({ ok: true });
});
