import { signInAdmin } from '@/lib/auth';
import { record } from '@/lib/audit';
import { fail, handler, ok } from '@/lib/http';

/**
 * Sign-in for the admin screen. Deliberately not under /api/admin, which is for
 * routes that already require an admin — this is the door, not a room.
 *
 * The admin URL is unlisted but guessable and the password is a single shared
 * secret, so unlimited guessing is the obvious way in. This keeps a per-address
 * failure count to make that impractical. It is in-process memory: it resets on
 * deploy and is not shared between instances, which is honest for a one-server
 * booster site and is not a substitute for a strong ADMIN_PASSWORD.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const attempts = new Map<string, { failures: number; first: number }>();

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Failures left for this caller, or null once it is locked out. */
function budget(key: string): number | null {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) return MAX_FAILURES;
  return rec.failures >= MAX_FAILURES ? null : MAX_FAILURES - rec.failures;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { failures: 1, first: now });
    return;
  }
  rec.failures += 1;
  // Bound the map so a flood of spoofed addresses cannot grow it forever.
  if (attempts.size > 5000) attempts.clear();
}

export const POST = handler(async (req: Request) => {
  const key = clientKey(req);
  if (budget(key) === null) {
    return fail('Too many attempts. Wait fifteen minutes and try again.', 429);
  }

  const body = (await req.json()) as Record<string, unknown>;
  const username = String(body.username ?? '');
  const password = String(body.password ?? '');

  if (!(await signInAdmin(username, password))) {
    recordFailure(key);
    record(req, 'admin-failed', { email: username });
    // One message for both fields — no hint about which half was wrong.
    return fail('That username and password do not match.', 401);
  }

  attempts.delete(key);
  record(req, 'admin', { email: username });
  return ok({ ok: true });
});
