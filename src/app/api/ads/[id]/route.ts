import { requireUser } from '@/lib/auth';
import { deleteAd, getAd, updateAd } from '@/lib/ads';
import { TEAMS, type TeamId } from '@/lib/config';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

async function ownedAd(id: number) {
  const user = await requireUser();
  const ad = getAd(id);
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return null;
  return { ad, isAdmin: !!user.is_admin };
}

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const found = await ownedAd(Number(id));
  if (!found) return fail('Ad not found.', 404);
  const { ad, isAdmin } = found;
  // The lock stops a parent rewriting an ad after it is paid for or called off.
  // It has never applied to the boosters — "contact the boosters if you need a
  // change" is only true if they can actually make one.
  if (!isAdmin && (ad.status === 'paid' || ad.status === 'cancelled')) {
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
    nameEffectColor:
      body.nameEffectColor === undefined ? undefined : String(body.nameEffectColor),
    textScale: body.textScale === undefined ? undefined : Number(body.textScale),
  });

  return ok({ ad: updated });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const found = await ownedAd(Number(id));
  if (!found) return fail('Ad not found.', 404);
  const { ad, isAdmin } = found;
  // A parent may throw away a draft — it is their own unfinished work and
  // nobody else is counting on it. Once submitted it stops being private: the
  // boosters are owed the money, `printableAds` is already laying it into the
  // book, and a cancelled ad is the record of an order that existed. So from
  // 'submitted' onwards the parent asks and the boosters act.
  //
  // An admin may delete anything, because somebody has to be able to remove a
  // duplicate order or an ad paid for by mistake — with the caveat that
  // 'cancelled' keeps the record and this does not. The admin screen offers
  // both and says which is which.
  if (!isAdmin && ad.status !== 'draft') {
    return fail(
      ad.status === 'paid'
        ? 'Paid ads cannot be deleted.'
        : 'Only drafts can be deleted. Contact the boosters to call off an ad you have already submitted.',
      409
    );
  }
  deleteAd(ad.id);
  return ok({ ok: true });
});
