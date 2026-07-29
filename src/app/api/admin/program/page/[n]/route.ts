import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { renderProgramPagePng } from '@/lib/render';
import { PRINT_DPI } from '@/lib/config';
import { fail, handler } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: Promise<{ n: string }> };

export const GET = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { n } = await ctx.params;
  const index = Number(n);
  if (!Number.isInteger(index) || index < 0) return fail('Bad page number.');

  const session = (await cookies()).get('whs_session')?.value;
  if (!session) return fail('Session missing.', 401);

  const paidOnly = new URL(req.url).searchParams.get('paidOnly') === '1';
  const png = await renderProgramPagePng(index, session, { paidOnly });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="program-page-${String(index + 1).padStart(3, '0')}-${PRINT_DPI}dpi.png"`,
      'Cache-Control': 'no-store',
    },
  });
});
