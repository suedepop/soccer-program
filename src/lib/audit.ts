import 'server-only';
import { db } from './db';

/**
 * Who got in, who tried, and from where.
 *
 * Recorded for the boosters rather than for security theatre: the questions
 * this actually answers are "did that parent ever manage to sign in?" and "is
 * somebody guessing at the admin password?". Both come up, and neither has an
 * answer without a log.
 *
 * Writing one of these must never be able to fail a sign-in — see record().
 */

export type LoginEventKind =
  | 'login'
  | 'failed'
  | 'signup'
  | 'admin'
  | 'admin-failed'
  | 'password-reset';

export interface LoginEvent {
  id: number;
  userId: number | null;
  email: string;
  kind: LoginEventKind;
  ip: string;
  userAgent: string;
  createdAt: string;
  /** The account's name now, when it still exists. */
  name: string | null;
}

/**
 * The caller's address as Caddy reports it. Everything reaches the app through
 * the proxy, so the socket address is always the proxy — X-Forwarded-For is the
 * only thing that carries the real one.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '').slice(0, 60);
}

/** Records one event. Swallows its own errors on purpose. */
export function record(
  req: Request,
  kind: LoginEventKind,
  who: { userId?: number | null; email?: string }
): void {
  try {
    db()
      .prepare(
        `INSERT INTO login_events (user_id, email, kind, ip, user_agent)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        who.userId ?? null,
        (who.email ?? '').toLowerCase().slice(0, 200),
        kind,
        clientIp(req),
        (req.headers.get('user-agent') ?? '').slice(0, 300)
      );
  } catch (err) {
    // A parent who cannot sign in because the audit table is unhappy would be
    // a far worse outage than a gap in the log.
    console.warn('[audit] Could not record a', kind, 'event:', err);
  }
}

export function listLoginEvents(limit = 250): LoginEvent[] {
  const rows = db()
    .prepare(
      `SELECT e.id, e.user_id, e.email, e.kind, e.ip, e.user_agent, e.created_at, u.name
         FROM login_events e
         LEFT JOIN users u ON u.id = e.user_id
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ?`
    )
    .all(limit) as {
    id: number;
    user_id: number | null;
    email: string;
    kind: string;
    ip: string;
    user_agent: string;
    created_at: string;
    name: string | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    kind: r.kind as LoginEventKind,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    name: r.name,
  }));
}

/** Failed attempts in the last day — the number worth noticing at a glance. */
export function countRecentFailures(): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS n FROM login_events
        WHERE kind IN ('failed', 'admin-failed')
          AND created_at >= datetime('now', '-1 day')`
    )
    .get() as { n: number };
  return row.n;
}
