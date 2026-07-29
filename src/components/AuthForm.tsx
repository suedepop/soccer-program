'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));

    const res = await fetch(`/api/auth/${mode}`, {
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
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      {error && <div className="notice notice-bad">{error}</div>}

      {signup && (
        <>
          <div>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" autoComplete="name" required />
          </div>
          <div>
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" />
            <div className="hint">Only used if we have a question about your ad.</div>
          </div>
        </>
      )}

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          required
          minLength={signup ? 8 : undefined}
        />
        {signup && <div className="hint">At least 8 characters.</div>}
      </div>

      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Just a moment…' : signup ? 'Create Account' : 'Sign In'}
      </button>

      <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
        {signup ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>.
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>.
          </>
        )}
      </div>
    </form>
  );
}
