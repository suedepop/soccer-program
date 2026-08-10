import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AdEditor from '@/components/AdEditor';
import { currentUser, findUserById } from '@/lib/auth';
import { getAd } from '@/lib/ads';
import { AD_STATUS } from '@/lib/config';

export const metadata = { title: 'Edit Ad' };
export const dynamic = 'force-dynamic';

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');

  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) notFound();

  const isAdmin = !!user.is_admin;
  const someoneElses = ad.userId !== user.id;
  const locked = ad.status === 'paid' || ad.status === 'cancelled';
  // A locked ad is a dead end for the parent who owns it. For an admin it is
  // the reason they came: fixing the ad nobody else is allowed to touch.
  if (locked && !isAdmin) redirect(`/ads/${ad.id}`);

  const owner = someoneElses ? findUserById(ad.userId) : null;

  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>
            {ad.playerName ? `${ad.playerName}'s ad` : someoneElses ? 'This ad' : 'Your ad'}
          </h1>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            Five steps — and every change saves as you go
          </div>
        </div>
        <Link className="btn btn-ghost" href={isAdmin && someoneElses ? '/admin' : '/dashboard'}>
          ← {isAdmin && someoneElses ? 'Back to admin' : 'All my ads'}
        </Link>
      </div>

      {someoneElses && (
        <div className="notice notice-warn" style={{ marginBottom: 14 }}>
          You are editing{' '}
          <strong>{owner?.name || owner?.email || 'another parent'}</strong>’s ad as an admin.
          Changes save as you go, and they will see them.
        </div>
      )}

      {locked && (
        <div className="notice notice-warn" style={{ marginBottom: 14 }}>
          This ad is <strong>{AD_STATUS[ad.status].label}</strong>, so its owner can no longer
          change it. You can — that is what the lock is for.
        </div>
      )}

      <AdEditor initialAd={ad} />
    </div>
  );
}
