import { findUserById, requireAdmin } from '@/lib/auth';
import { deletePhoto, photoUsage } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/**
 * Removes a photo from a parent's library, on their behalf.
 *
 * Mirrors the owner's own `/api/photos/[id]`, including the refusal that
 * matters: `ad_photos.file_id` cascades, so deleting a photo an ad still places
 * would tear it out of that ad with no warning — and an admin is doing this to
 * somebody else's pages, possibly ones already paid for and laid into the book.
 * The answer names the ads to clear first, which an admin can do themselves.
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id, fileId } = await ctx.params;

  const target = findUserById(Number(id));
  if (!target) return fail('No such account.', 404);

  const photoId = Number(fileId);
  if (!Number.isInteger(photoId)) return fail('Which photo?');

  // Scoped to the named account, so a mistyped id cannot reach into another
  // library: the photo has to belong to the parent whose page this is.
  const usage = photoUsage(target.id, photoId);
  if (usage.length) {
    const names = usage.map((u) => u.playerName.trim() || `ad #${u.adId}`);
    return fail(
      `That photo is still used by ${names.join(', ')}. Remove it from ${
        usage.length === 1 ? 'that ad' : 'those ads'
      } first.`,
      409
    );
  }

  const removed = await deletePhoto(target.id, photoId);
  if (!removed) return fail('Photo not found.', 404);
  return ok({ ok: true });
});
