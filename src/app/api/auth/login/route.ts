import { createSession, findUserByEmail, verifyPassword } from '@/lib/auth';
import { record } from '@/lib/audit';
import { fail, handler, ok } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const body = (await req.json()) as Record<string, unknown>;
  const email = String(body.email ?? '');
  const password = String(body.password ?? '');

  const user = findUserByEmail(email);
  // Same message either way so the form does not confirm which emails exist.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    // The attempted address is logged even when no such account exists —
    // "somebody is guessing at addresses" is exactly what the log is for.
    record(req, 'failed', { userId: user?.id ?? null, email });
    return fail('That email and password do not match.', 401);
  }

  record(req, 'login', { userId: user.id, email: user.email });
  await createSession(user.id);
  return ok({ id: user.id, isAdmin: !!user.is_admin });
});
