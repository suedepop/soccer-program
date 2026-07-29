import { requireUser } from '@/lib/auth';
import { getAd, setPhoto, setPhotoFocal } from '@/lib/ads';
import { getLayout } from '@/lib/layouts';
import { storeUpload, UploadError } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') return fail('This ad is locked.', 409);

  const form = await req.formData();
  const slot = Number(form.get('slot'));
  const file = form.get('file');

  const slotCount = getLayout(ad.layoutId, ad.size).photos.length;
  if (!Number.isInteger(slot) || slot < 0 || slot >= slotCount) {
    return fail('That photo slot does not exist on this layout.');
  }
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image to upload.');

  try {
    const stored = await storeUpload(user.id, file);
    setPhoto(ad.id, slot, stored.id);
    return ok({ photo: { slot, fileId: stored.id, url: `/api/files/${stored.id}`, ...stored } });
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, 415);
    throw err;
  }
});

/** Reposition an existing photo inside its slot (object-position). */
export const PUT = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) return fail('Ad not found.', 404);
  if (ad.status === 'paid' || ad.status === 'cancelled') return fail('This ad is locked.', 409);

  const body = (await req.json()) as Record<string, unknown>;
  const slot = Number(body.slot);
  if (!Number.isInteger(slot)) return fail('Which photo slot?');
  setPhotoFocal(ad.id, slot, Number(body.focalX), Number(body.focalY));
  return ok({ ok: true });
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
