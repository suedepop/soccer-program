import { findUserById, requireAdmin } from '@/lib/auth';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';
import { libraryRoom, listPhotos, storePhotos } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * One parent's photo library, from the boosters' side.
 *
 * Same response shape as `/api/photos` so the browser can drive either with the
 * same hook. The images themselves need no new endpoint: `/api/files/[id]`
 * already serves any file to an admin.
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const target = findUserById(Number(id));
  if (!target) return fail('No such account.', 404);

  return ok({ photos: listPhotos(target.id), limit: MAX_LIBRARY_PHOTOS });
});

/**
 * Adds photos to that parent's library on their behalf — the answer to "I have
 * the media-day shots, can you just put them in for me?", which otherwise means
 * talking a parent through an upload over the phone.
 *
 * The photos land in the parent's own library, indistinguishable from ones they
 * uploaded: theirs to place into any ad, and theirs to delete. The cap is the
 * account's, not the uploader's, so a helpful admin cannot fill a library past
 * the point where its owner can add anything themselves.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const target = findUserById(Number(id));
  if (!target) return fail('No such account.', 404);

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail('Choose at least one image to upload.');

  // Applies to the whole batch — the boosters upload a photographer's set in
  // one go, and mixing licensed and unlicensed images in a single selection is
  // not the shape the job comes in. This is the only route that can set it:
  // a parent's own upload is always unmanaged.
  const rightsManaged = form.get('rightsManaged') === '1';

  const room = libraryRoom(target.id);
  if (room === 0) {
    return fail(
      `${target.name || target.email} already has the full ${MAX_LIBRARY_PHOTOS} photos. They will need to delete a few before anything else fits.`,
      409
    );
  }

  const result = await storePhotos(target.id, files, room, { rightsManaged });

  return ok({
    ...result,
    photos: listPhotos(target.id),
    limit: MAX_LIBRARY_PHOTOS,
  });
});
