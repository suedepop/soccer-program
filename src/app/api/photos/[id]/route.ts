import { requireUser } from '@/lib/auth';
import { deletePhoto, photoUsage } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Removes a photo from the library.
 *
 * Refused while any ad still places it. ad_photos cascades on file delete, so
 * allowing this would tear the photo out of finished ads with no warning — the
 * parent is told which ads to clear first instead.
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId)) return fail('Which photo?');

  const usage = photoUsage(user.id, fileId);
  if (usage.length) {
    const names = usage.map((u) => u.playerName.trim() || `ad #${u.adId}`);
    return fail(
      `That photo is still used by ${names.join(', ')}. Remove it from ${
        usage.length === 1 ? 'that ad' : 'those ads'
      } first.`,
      409
    );
  }

  const removed = await deletePhoto(user.id, fileId);
  if (!removed) return fail('Photo not found.', 404);
  return ok({ ok: true });
});
