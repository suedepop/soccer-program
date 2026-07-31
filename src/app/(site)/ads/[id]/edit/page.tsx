import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AdEditor from '@/components/AdEditor';
import { currentUser } from '@/lib/auth';
import { getAd } from '@/lib/ads';

export const metadata = { title: 'Edit Ad' };
export const dynamic = 'force-dynamic';

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');

  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) notFound();
  if (ad.status === 'paid' || ad.status === 'cancelled') redirect(`/ads/${ad.id}`);

  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>
            {ad.playerName ? `${ad.playerName}'s ad` : 'Your ad'}
          </h1>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            Five steps — and every change saves as you go
          </div>
        </div>
        <Link className="btn btn-ghost" href="/dashboard">
          ← All my ads
        </Link>
      </div>

      <AdEditor initialAd={ad} />
    </div>
  );
}
