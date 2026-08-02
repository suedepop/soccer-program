'use client';

import { useState } from 'react';
import type { AdminUser } from '@/lib/admin';

/**
 * Every account, and the one thing an admin regularly needs to do to one:
 * give a parent a new password.
 *
 * The new password appears once, in the row, and is never stored anywhere in
 * readable form — an admin who closes the page before writing it down issues
 * another. That is deliberate: a password sitting in a database for later
 * retrieval is a worse problem than an extra phone call.
 */
export default function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const [issued, setIssued] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset(user: AdminUser) {
    const ok = window.confirm(
      `Give ${user.email} a new password?\n\nTheir current one stops working straight away, and you will need to pass the new one on.`
    );
    if (!ok) return;

    setBusy(user.id);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/password`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setError(json.error ?? 'Could not reset that password.');
      return;
    }
    setIssued((prev) => ({ ...prev, [user.id]: json.password }));
  }

  return (
    <div className="card">
      {error && (
        <div className="notice notice-bad" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="table-scroll">
        <table className="data">
          <thead>
            <tr>
              <th>Account</th>
              <th>Joined</th>
              <th>Last signed in</th>
              <th>Ads</th>
              <th>Photos</th>
              <th>Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div>
                    <strong>{u.name || '—'}</strong>
                    {u.isAdmin && (
                      <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                        Boosters
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    <a href={`mailto:${u.email}`}>{u.email}</a>
                    {u.phone && <div>{u.phone}</div>}
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{u.createdAt.slice(0, 10)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {u.lastLoginAt ? (
                    u.lastLoginAt.slice(0, 16)
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>never</span>
                  )}
                </td>
                <td>{u.ads}</td>
                <td>{u.photos}</td>
                <td style={{ minWidth: 210 }}>
                  {issued[u.id] ? (
                    <div className="notice notice-ok" style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12 }}>New password — copy it now:</div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>
                        {issued[u.id]}
                      </div>
                    </div>
                  ) : u.isCredentialRow ? (
                    <span className="hint">Set by ADMIN_PASSWORD</span>
                  ) : (
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={busy === u.id}
                      onClick={() => reset(u)}
                    >
                      {busy === u.id ? 'Resetting…' : 'Reset password'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
                  Nobody has signed up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="hint" style={{ marginTop: 10 }}>
        A reset takes effect immediately, but it does not sign the parent out of a browser they
        are already signed in on — those cookies are signed tokens and this site keeps no list to
        revoke them from. Times are UTC.
      </div>
    </div>
  );
}
