'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Password prompt shown in place of the admin screen. Its own username and
 * password, not a parent account — see the admin section of src/lib/auth.ts.
 */
export default function AdminGate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch('/api/auth/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.');
      setBusy(false);
      return;
    }
    // The page is a server component reading the session, so re-render it
    // rather than navigating — the admin lands straight on the screen.
    router.refresh();
  }

  return (
    <div className="wrap-narrow page">
      <h1>Boosters only</h1>
      <p style={{ color: 'var(--muted)' }}>
        This screen is for the ad committee. If you are looking for your own ad, it is under{' '}
        <strong>My Ads</strong>.
      </p>
      <form className="card stack" onSubmit={onSubmit}>
        {error && <div className="notice notice-bad">{error}</div>}
        <div>
          <label htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            name="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>
        <div>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
