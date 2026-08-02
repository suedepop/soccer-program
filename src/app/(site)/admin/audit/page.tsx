import { countRecentFailures, listLoginEvents, type LoginEventKind } from '@/lib/audit';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Admin · Audit' };
export const dynamic = 'force-dynamic';

const LABELS: Record<LoginEventKind, { text: string; tone: string }> = {
  login: { text: 'Signed in', tone: 'badge-ok' },
  failed: { text: 'Failed sign-in', tone: 'badge-bad' },
  signup: { text: 'Created account', tone: 'badge-muted' },
  admin: { text: 'Boosters screen', tone: 'badge-warn' },
  'admin-failed': { text: 'Boosters failed', tone: 'badge-bad' },
  'password-reset': { text: 'Password reset', tone: 'badge-warn' },
};

export default async function AdminAuditPage() {
  const user = await currentUser();
  if (!user?.is_admin) return null;

  const events = listLoginEvents();
  const failures = countRecentFailures();

  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Sign-in history</h2>
          <div className="hint" style={{ marginTop: 2 }}>
            The most recent {events.length} event{events.length === 1 ? '' : 's'}, newest first.
            Times are UTC.
          </div>
        </div>
      </div>

      {failures > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: 12 }}>
          {failures} failed attempt{failures === 1 ? '' : 's'} in the last 24 hours. A handful is
          somebody mistyping; a steady stream from one address is somebody guessing.
        </div>
      )}

      <div className="card">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Who</th>
                <th>From</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const label = LABELS[e.kind] ?? { text: e.kind, tone: 'badge-muted' };
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.createdAt.slice(0, 16)}</td>
                    <td>
                      <span className={`badge ${label.tone}`}>{label.text}</span>
                    </td>
                    <td>
                      <div>{e.name || <span style={{ color: 'var(--muted)' }}>—</span>}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.email || '—'}</div>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <div className="mono">{e.ip || '—'}</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={e.userAgent}
                      >
                        {e.userAgent || '—'}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}
                  >
                    Nothing recorded yet. Sign-ins appear here from the moment this shipped —
                    anything earlier happened before there was a log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
