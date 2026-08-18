import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AdPreview from '@/components/AdPreview';
import DeleteAdButton from '@/components/DeleteAdButton';
import RichText from '@/components/RichText';
import StatusBadge from '@/components/StatusBadge';
import SubmitAdButton from '@/components/SubmitAdButton';
import { currentUser } from '@/lib/auth';
import { getAd, validateForSubmit } from '@/lib/ads';
import { getLayout, photoQuality } from '@/lib/layouts';
import { getBackground } from '@/lib/backgrounds';
import { AD_SIZES, SCHOOL, TEAMS, formatMoney } from '@/lib/config';

export const metadata = { title: 'Your Ad' };
export const dynamic = 'force-dynamic';

export default async function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');

  const ad = getAd(Number(id));
  if (!ad || (ad.userId !== user.id && !user.is_admin)) notFound();

  const spec = AD_SIZES[ad.size];
  const layout = getLayout(ad.layoutId, ad.size);
  const issues = validateForSubmit(ad);
  const editable = ad.status === 'draft' || ad.status === 'submitted';

  const soft = layout.photos
    .map((slot, i) => {
      const photo = ad.photos.find((p) => p.slot === i);
      return photo ? { i, ...photoQuality(ad.size, slot, photo, photo.zoom ?? 1) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.quality !== 'good');

  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{ad.playerName || 'Your ad'}</h1>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge status={ad.status} />
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              {spec.label} · {formatMoney(ad.priceCents)} ·{' '}
              {TEAMS.find((t) => t.id === ad.team)?.label}
            </span>
          </div>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" href="/dashboard">
            ← All my ads
          </Link>
          {editable && (
            <Link className="btn btn-secondary" href={`/ads/${ad.id}/edit`}>
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="editor-grid">
        <div className="card">
          <AdPreview ad={ad} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
            {layout.name} layout · {getBackground(ad.backgroundId).name} background ·{' '}
            {spec.widthIn}&Prime; × {spec.heightIn}&Prime; at 300 DPI
          </div>
        </div>

        <div className="stack">
          {ad.status === 'draft' && (
            <div className="card">
              <h3>Ready to submit?</h3>
              {issues.length > 0 ? (
                <>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                    A couple of things first:
                  </p>
                  <ul style={{ paddingLeft: 18, fontSize: 14 }}>
                    {issues.map((i) => (
                      <li key={i.field}>{i.message}</li>
                    ))}
                  </ul>
                  <Link className="btn" href={`/ads/${ad.id}/edit`}>
                    Finish the ad
                  </Link>
                </>
              ) : (
                <SubmitAdButton
                  adId={ad.id}
                  disabled={false}
                  warn={
                    soft.length
                      ? `${soft.length} photo${soft.length > 1 ? 's are' : ' is'} below 300 DPI and may print soft. You can still submit — or go back and swap in a larger file.`
                      : undefined
                  }
                />
              )}
            </div>
          )}

          {ad.status === 'submitted' && (
            <div className="card">
              <h3>Payment due — {formatMoney(ad.priceCents)}</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                Your ad is in. We collect payment off the website; once the boosters record it,
                this page will say <strong>Paid</strong>.
              </p>
              <ul style={{ paddingLeft: 18, fontSize: 14 }}>
                {SCHOOL.paymentInstructions.map((line, i) => (
                  <li
                    key={i}
                    // Keeps the newlines in the mailing address.
                    style={{ whiteSpace: 'pre-line' }}
                    dangerouslySetInnerHTML={{ __html: bold(line) }}
                  />
                ))}
              </ul>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Submitted {ad.submittedAt?.slice(0, 10)}. You can still edit until it’s marked
                paid.
              </p>
            </div>
          )}

          {ad.status === 'paid' && (
            <div className="card">
              <h3>Paid — thank you!</h3>
              <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                Recorded {ad.paidAt?.slice(0, 10)}. This ad is locked for print. Need a change?
                Email <a href={`mailto:${SCHOOL.contactEmail}`}>{SCHOOL.contactEmail}</a>.
              </p>
            </div>
          )}

          {ad.status === 'cancelled' && (
            <div className="card">
              <h3>Cancelled</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                This ad was cancelled. Contact {SCHOOL.contactEmail} if that’s a surprise.
              </p>
            </div>
          )}

          {soft.length > 0 && (
            <div className="notice notice-warn">
              <strong>Photo quality</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {soft.map((s) => (
                  <li key={s.i}>
                    Photo {s.i + 1} prints at about {s.effectiveDpi} DPI (we want 300). It needs to
                    be at least {s.required.w}×{s.required.h}px in this spot.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card card-tight" style={{ fontSize: 13.5 }}>
            <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Message</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {ad.message ? <RichText source={ad.message} /> : '—'}
            </div>
            <div style={{ color: 'var(--muted)', margin: '10px 0 4px' }}>From</div>
            <div>{ad.attribution ? <RichText source={ad.attribution} /> : '—'}</div>
          </div>

          {/* Last in the column on purpose: it is the one thing on this page
              that cannot be undone. */}
          {ad.status === 'draft' && (
            <div className="card card-tight">
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                Changed your mind? A draft can be deleted right up until you submit it.
              </div>
              <DeleteAdButton adId={ad.id} playerName={ad.playerName} redirectTo="/dashboard" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function bold(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
