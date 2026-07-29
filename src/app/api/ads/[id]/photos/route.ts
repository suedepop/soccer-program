import { requireUser } from '@/lib/auth';
import { getAd, setPhoto, setPhotoTransform } from '@/lib/ads';
import { getLayout } from '@/lib/layouts';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';
import { countPhotos, getFileRow, storeUpload, UploadError } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Places a photo in a slot.
 *
 * JSON `{ slot, fileId }` picks an existing photo out of the parent's library —
 * the normal path now that photos are uploaded once and reused.
 *
 * A multipart body with `slot` and `file` still uploads straight into the slot,
 * adding the image to the library on the way. That keeps a one-step path for
 * scripts and for "upload and use this right now".
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') return fail('This ad is locked.', 409);

  const slotCount = getLayout(ad.layoutId, ad.size).photos.length;
  const checkSlot = (slot: number) =>
    Number.isInteger(slot) && slot >= 0 && slot < slotCount;

  const contentType = req.headers.get('content-type') ?? '';

  // --- pick from the library -------------------------------------------
  if (contentType.includes('application/json')) {
    const body = (await req.json()) as Record<string, unknown>;
    const slot = Number(body.slot);
    const fileId = Number(body.fileId);
    if (!checkSlot(slot)) return fail('That photo slot does not exist on this layout.');

    const row = getFileRow(fileId);
    // Ads belong to their owner even when an admin is editing, so the photo
    // has to come from that owner's library — not the signed-in admin's.
    if (!row || row.user_id !== ad.userId) return fail('That photo is not in your library.', 404);

    setPhoto(ad.id, slot, row.id);
    return ok({
      photo: {
        slot,
        fileId: row.id,
        url: `/api/files/${row.id}`,
        width: row.width,
        height: row.height,
        origName: row.orig_name,
      },
    });
  }

  // --- upload straight into the slot -----------------------------------
  const form = await req.formData();
  const slot = Number(form.get('slot'));
  const file = form.get('file');

  if (!checkSlot(slot)) return fail('That photo slot does not exist on this layout.');
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image to upload.');

  const used = countPhotos(ad.userId);
  if (used >= MAX_LIBRARY_PHOTOS) {
    return fail(
      `Your photo library is full (${MAX_LIBRARY_PHOTOS} photos). Delete a few before adding more.`,
      409
    );
  }

  try {
    const stored = await storeUpload(ad.userId, file);
    setPhoto(ad.id, slot, stored.id);
    return ok({ photo: { slot, fileId: stored.id, url: `/api/files/${stored.id}`, ...stored } });
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, 415);
    throw err;
  }
});

/** Nudge and zoom an existing photo inside its slot. */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') return fail('This ad is locked.', 409);

  const body = (await req.json()) as Record<string, unknown>;
  const slot = Number(body.slot);
  if (!Number.isInteger(slot)) return fail('Which photo slot?');

  const existing = ad.photos.find((p) => p.slot === slot);
  if (!existing) return fail('There is no photo in that slot.', 404);

  // Values are clamped in setPhotoTransform, so anything out of range is
  // pulled back in rather than rejected.
  setPhotoTransform(
    ad.id,
    slot,
    body.focalX === undefined ? existing.focalX : Number(body.focalX),
    body.focalY === undefined ? existing.focalY : Number(body.focalY),
    body.zoom === undefined ? existing.zoom : Number(body.zoom)
  );

  const updated = getAd(ad.id)?.photos.find((p) => p.slot === slot);
  return ok({ photo: updated });
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') return fail('This ad is locked.', 409);

  const slot = Number(new URL(req.url).searchParams.get('slot'));
  if (!Number.isInteger(slot)) return fail('Which photo slot?');
  setPhoto(ad.id, slot, null);
  return ok({ ok: true });
});
