import { requireUser } from '@/lib/auth';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';
import { countPhotos, listPhotos, storeUpload, UploadError } from '@/lib/files';
import { fail, handler, ok } from '@/lib/http';

export const runtime = 'nodejs';

/** The signed-in parent's photo library. */
export const GET = handler(async () => {
  const user = await requireUser();
  return ok({
    photos: listPhotos(user.id),
    limit: MAX_LIBRARY_PHOTOS,
  });
});

/**
 * Adds one or more photos to the library. Accepts a multipart body with any
 * number of `files` entries so a parent can select a whole folder at once.
 *
 * Uploads past the limit are skipped and reported rather than failing the whole
 * batch — losing 40 good uploads because the 41st crossed the line would be a
 * miserable way to find out about the cap.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail('Choose at least one image to upload.');

  const used = countPhotos(user.id);
  const room = Math.max(0, MAX_LIBRARY_PHOTOS - used);
  if (room === 0) {
    return fail(
      `Your library is full (${MAX_LIBRARY_PHOTOS} photos). Delete a few before adding more.`,
      409
    );
  }

  const added = [];
  const errors: string[] = [];
  for (const file of files.slice(0, room)) {
    try {
      added.push(await storeUpload(user.id, file));
    } catch (err) {
      if (err instanceof UploadError) {
        errors.push(`${file.name}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  const skipped = files.length - Math.min(files.length, room);

  return ok({
    added: added.length,
    skipped,
    errors,
    photos: listPhotos(user.id),
    limit: MAX_LIBRARY_PHOTOS,
  });
});
