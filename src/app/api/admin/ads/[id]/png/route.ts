import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { getAd } from '@/lib/ads';
import { renderAdPng } from '@/lib/render';
import { AD_SIZES, PRINT_DPI } from '@/lib/config';
import { fail, handler } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const ad = getAd(Number(id));
  if (!ad) return fail('Ad not found.', 404);

  const session = (await cookies()).get('whs_session')?.value;
  if (!session) return fail('Session missing.', 401);

  const png = await renderAdPng(ad.id, ad.size, session);
  const spec = AD_SIZES[ad.size];
  const slug =
    (ad.playerName || 'ad').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'ad';

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="whs-${ad.size}-${slug}-${ad.id}-${PRINT_DPI}dpi-${spec.widthIn}x${spec.heightIn}in.png"`,
      'Cache-Control': 'no-store',
    },
  });
});
