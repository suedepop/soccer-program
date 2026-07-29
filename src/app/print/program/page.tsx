import { notFound } from 'next/navigation';
import AdCanvas from '@/components/AdCanvas';
import { requireAdmin } from '@/lib/auth';
import { listAllAds } from '@/lib/ads';
import { imposeSheets } from '@/lib/impose';
import { CSS_DPI } from '@/lib/config';

export const dynamic = 'force-dynamic';

const SHEET_W = 8.5 * CSS_DPI; // 816
const SHEET_H = 11 * CSS_DPI; // 1056

export default async function PrintProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; paidOnly?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const paidOnly = sp.paidOnly === '1';
  const ads = listAllAds().filter((a) =>
    paidOnly ? a.status === 'paid' : a.status === 'paid' || a.status === 'submitted'
  );

  const sheets = imposeSheets(ads);
  const only = sp.page !== undefined ? Number(sp.page) : null;
  if (only !== null && (!Number.isInteger(only) || only < 0 || only >= sheets.length)) {
    notFound();
  }
  const visible = only === null ? sheets : [sheets[only]];

  return (
    <div data-print-ready>
      {visible.map((sheet, i) => (
        <div
          key={i}
          className="sheet"
          style={{ width: SHEET_W, height: SHEET_H, position: 'relative', background: '#fff' }}
        >
          {sheet.map((p) => (
            <div
              key={p.ad.id}
              // Exposed so scripts/smoke.mjs can check the imposition without
              // re-implementing it: which ads share a sheet, and what they look
              // like.
              data-ad-id={p.ad.id}
              data-ad-size={p.ad.size}
              data-ad-background={p.ad.backgroundId}
              data-ad-layout={p.ad.layoutId}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}%`,
                height: `${p.h}%`,
                overflow: 'hidden',
              }}
            >
              <AdCanvas ad={p.ad} scale={1} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
