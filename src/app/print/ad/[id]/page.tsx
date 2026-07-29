import { notFound } from 'next/navigation';
import AdCanvas from '@/components/AdCanvas';
import { currentUser } from '@/lib/auth';
import { getAd } from '@/lib/ads';
import { AD_SIZES, CSS_DPI } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function PrintAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const ad = getAd(Number(id));
  if (!user || !ad || (ad.userId !== user.id && !user.is_admin)) notFound();

  const spec = AD_SIZES[ad.size];

  return (
    <div
      data-print-ready
      style={{
        width: spec.widthIn * CSS_DPI,
        height: spec.heightIn * CSS_DPI,
        overflow: 'hidden',
      }}
    >
      <AdCanvas ad={ad} scale={1} />
    </div>
  );
}
