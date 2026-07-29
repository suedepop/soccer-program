import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { renderProgramPdf } from '@/lib/render';
import { fail, handler } from '@/lib/http';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const session = (await cookies()).get('whs_session')?.value;
  if (!session) return fail('Session missing.', 401);

  const paidOnly = new URL(req.url).searchParams.get('paidOnly') === '1';
  const pdf = await renderProgramPdf(session, { paidOnly });

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="weir-high-soccer-program${paidOnly ? '-paid' : ''}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});
