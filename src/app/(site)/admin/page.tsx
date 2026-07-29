import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import AdCanvas from '@/components/AdCanvas';
import AdminAdControls from '@/components/AdminAdControls';
import StatusBadge from '@/components/StatusBadge';
import { currentUser } from '@/lib/auth';
import { listAllAds } from '@/lib/ads';
import { fourUpSheetCount, imposeSheets } from '@/lib/impose';
import { getLayout, photoQuality } from '@/lib/layouts';
import { AD_SIZES, AD_STATUS, CSS_DPI, formatMoney, type AdStatus } from '@/lib/config';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!user.is_admin) notFound();

  const sp = await searchParams;
  const filter = (sp.status && sp.status in AD_STATUS ? sp.status : undefined) as
    | AdStatus
    | undefined;

  const all = listAllAds();
  const ads = filter ? all.filter((a) => a.status === filter) : all;

  const totals = {
    submitted: all.filter((a) => a.status === 'submitted'),
    paid: all.filter((a) => a.status === 'paid'),
    draft: all.filter((a) => a.status === 'draft'),
  };
  const owed = totals.submitted.reduce((s, a) => s + a.priceCents, 0);
  const collected = totals.paid.reduce((s, a) => s + a.priceCents, 0);

  const bookAds = all.filter((a) => a.status === 'paid' || a.status === 'submitted');
  const sheets = imposeSheets(bookAds);
  const paidSheets = imposeSheets(all.filter((a) => a.status === 'paid'));
  const fourUp = fourUpSheetCount(sheets);

  return (
    <div className="wrap page">
      <h1>Admin</h1>

      <div className="pricing" style={{ marginBottom: 20 }}>
        <Stat label="Payment due" value={formatMoney(owed)} sub={`${totals.submitted.length} ads`} tone="warn" />
        <Stat label="Collected" value={formatMoney(collected)} sub={`${totals.paid.length} ads`} tone="ok" />
        <Stat
          label="Program length"
          value={`${sheets.length} page${sheets.length === 1 ? '' : 's'}`}
          sub={`${bookAds.length} ads placed · ${totals.draft.length} still drafts`}
          tone="muted"
        />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Print files</h3>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Everything renders at 300 DPI from the same layout the parent previewed. The PDF is the
          assembled book — full pages get their own sheet, and half pages are paired with two
          quarters where possible so the book isn’t a grid of small boxes. Similar backgrounds and
          layouts are kept off the same sheet.
        </p>
        {fourUp > 0 && (
          <div className="notice notice-info" style={{ marginBottom: 12 }}>
            {fourUp} sheet{fourUp === 1 ? '' : 's'} still {fourUp === 1 ? 'has' : 'have'} four
            quarter-page ads. There aren’t enough half-page ads left to pair them with — selling a
            few more half pages would break them up.
          </div>
        )}
        <div className="row">
          <a className="btn" href="/api/admin/program/pdf">
            Program PDF ({sheets.length} pages)
          </a>
          <a className="btn btn-secondary" href="/api/admin/program/pdf?paidOnly=1">
            Paid ads only ({paidSheets.length} pages)
          </a>
          <a
            className="btn btn-ghost"
            href="/print/program"
            target="_blank"
            rel="noreferrer"
          >
            Preview in browser
          </a>
        </div>
        {sheets.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Download individual pages as 300 DPI PNGs (2550×3300)
            </summary>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              {sheets.map((_, i) => (
                <a
                  key={i}
                  className="btn btn-sm btn-secondary"
                  href={`/api/admin/program/page/${i}`}
                >
                  Page {i + 1}
                </a>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <FilterLink current={filter} value={undefined} label={`All (${all.length})`} />
        {(Object.keys(AD_STATUS) as AdStatus[]).map((s) => (
          <FilterLink
            key={s}
            current={filter}
            value={s}
            label={`${AD_STATUS[s].label} (${all.filter((a) => a.status === s).length})`}
          />
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Ordered by</th>
              <th>Size</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const layout = getLayout(ad.layoutId, ad.size);
              const lowRes = layout.photos.filter((slot, i) => {
                const p = ad.photos.find((x) => x.slot === i);
                return p && photoQuality(ad.size, slot, p, p.zoom ?? 1).quality !== 'good';
              }).length;

              return (
                <tr key={ad.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: '0 0 auto' }}>
                        <AdCanvas ad={ad} scale={110 / (AD_SIZES[ad.size].widthIn * CSS_DPI)} />
                      </div>
                      <div>
                        <strong>{ad.playerName || '(no name yet)'}</strong>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          #{ad.id} · {layout.name}
                        </div>
                        {lowRes > 0 && (
                          <div className="badge badge-warn" style={{ marginTop: 4 }}>
                            {lowRes} low-res photo{lowRes > 1 ? 's' : ''}
                          </div>
                        )}
                        {ad.adminNotes && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                            📝 {ad.adminNotes.slice(0, 80)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{ad.ownerName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      <a href={`mailto:${ad.ownerEmail}`}>{ad.ownerEmail}</a>
                      {ad.ownerPhone && <div>{ad.ownerPhone}</div>}
                    </div>
                  </td>
                  <td>
                    {AD_SIZES[ad.size].label}
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                      {formatMoney(ad.priceCents)}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={ad.status} />
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                      {ad.paidAt
                        ? `paid ${ad.paidAt.slice(0, 10)}`
                        : ad.submittedAt
                          ? `submitted ${ad.submittedAt.slice(0, 10)}`
                          : `started ${ad.createdAt.slice(0, 10)}`}
                    </div>
                  </td>
                  <td style={{ minWidth: 230 }}>
                    <AdminAdControls adId={ad.id} status={ad.status} notes={ad.adminNotes} />
                  </td>
                </tr>
              );
            })}
            {ads.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'ok' | 'warn' | 'muted';
}) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink)';
  return (
    <div className="card">
      <div className="kicker">{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}

function FilterLink({
  current,
  value,
  label,
}: {
  current?: AdStatus;
  value?: AdStatus;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      className={`btn btn-sm ${active ? '' : 'btn-secondary'}`}
      href={value ? `/admin?status=${value}` : '/admin'}
    >
      {label}
    </Link>
  );
}
