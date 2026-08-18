import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdCanvas from '@/components/AdCanvas';
import DeleteAdButton from '@/components/DeleteAdButton';
import StatusBadge from '@/components/StatusBadge';
import { currentUser } from '@/lib/auth';
import { listAdsForUser } from '@/lib/ads';
import { AD_SIZES, SCHOOL, formatMoney } from '@/lib/config';

export const metadata = { title: 'My Ads' };
export const dynamic = 'force-dynamic';

/** Preview thumbnails are ~200px wide regardless of ad size. */
function thumbScale(size: keyof typeof AD_SIZES) {
  return 200 / (AD_SIZES[size].widthIn * 96);
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const ads = listAdsForUser(user.id);
  const due = ads
    .filter((a) => a.status === 'submitted')
    .reduce((sum, a) => sum + a.priceCents, 0);

  return (
    <div className="wrap page">
      <div className="spread">
        <div>
          <h1 style={{ marginBottom: 4 }}>My ads</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Signed in as {user.email}. Ads are due {SCHOOL.deadline}.
          </p>
        </div>
        <Link className="btn" href="/ads/new">
          Create an Ad
        </Link>
      </div>

      {due > 0 && (
        <div className="notice notice-warn" style={{ marginTop: 18 }}>
          <strong>{formatMoney(due)} due.</strong> We collect payment outside the website — see the
          instructions on any submitted ad. Your status flips to <em>Paid</em> once the boosters
          record it.
        </div>
      )}

      {ads.length === 0 ? (
        <div className="card" style={{ marginTop: 18, textAlign: 'center', padding: 42 }}>
          <h3>No ads yet</h3>
          <p style={{ color: 'var(--muted)' }}>
            Pick a size and we’ll walk you through the rest. It takes about five minutes.
          </p>
          <Link className="btn" href="/ads/new">
            Create your first ad
          </Link>
        </div>
      ) : (
        <div className="ad-grid" style={{ marginTop: 18 }}>
          {ads.map((ad) => (
            <div className="card" key={ad.id} style={{ padding: 14 }}>
              <div className="preview-stage" style={{ padding: 10 }}>
                <AdCanvas ad={ad} scale={thumbScale(ad.size)} />
              </div>
              <div className="spread" style={{ marginTop: 12 }}>
                <strong>{ad.playerName || 'Untitled ad'}</strong>
                <StatusBadge status={ad.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {AD_SIZES[ad.size].label} · {formatMoney(ad.priceCents)}
                {ad.paidAt && ` · paid ${ad.paidAt.slice(0, 10)}`}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn btn-sm btn-secondary" href={`/ads/${ad.id}`}>
                  View
                </Link>
                {ad.status !== 'paid' && ad.status !== 'cancelled' && (
                  <Link className="btn btn-sm" href={`/ads/${ad.id}/edit`}>
                    {ad.status === 'draft' ? 'Continue' : 'Edit'}
                  </Link>
                )}
                {ad.status === 'draft' && (
                  <DeleteAdButton adId={ad.id} playerName={ad.playerName} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
