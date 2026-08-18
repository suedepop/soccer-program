import { requireUser } from '@/lib/auth';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';
import { libraryRoom, listPhotos, storePhotos } from '@/lib/files';
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

  const room = libraryRoom(user.id);
  if (room === 0) {
    return fail(
      `Your library is full (${MAX_LIBRARY_PHOTOS} photos). Delete a few before adding more.`,
      409
    );
  }

  const result = await storePhotos(user.id, files, room);

  return ok({
    ...result,
    photos: listPhotos(user.id),
    limit: MAX_LIBRARY_PHOTOS,
  });
});
