import fs from 'node:fs/promises';
import { requireUser } from '@/lib/auth';
import { filePath, getFileRow } from '@/lib/files';
import { fail, handler } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const row = getFileRow(Number(id));
  if (!row) return fail('Not found.', 404);
  if (row.user_id !== user.id && !user.is_admin) return fail('Not found.', 404);

  const bytes = await fs.readFile(filePath(row));
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(bytes.byteLength),
      // Uploads are immutable — the id changes when the photo does.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});
