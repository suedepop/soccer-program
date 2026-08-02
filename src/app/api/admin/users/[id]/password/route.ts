import { isAdminCredentialAccount, requireAdmin } from '@/lib/auth';
import { record } from '@/lib/audit';
import { resetPassword } from '@/lib/admin';
import { db } from '@/lib/db';
import { fail, handler, ok } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Issues a parent a new password, for the phone call that starts "I can't get
 * in". There is no email on this site to send a reset link through, so the
 * admin reads them the new one and they change it at their leisure.
 *
 * The plaintext is returned exactly once and never stored.
 */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const user = db()
    .prepare('SELECT id, email, is_admin FROM users WHERE id = ?')
    .get(Number(id)) as { id: number; email: string; is_admin: number } | undefined;

  if (!user) return fail('No such account.', 404);

  // Only the ADMIN_PASSWORD stub, not every account carrying the admin flag —
  // the first parent to sign up is made an admin and has a real password of
  // their own. Giving the stub a working password would quietly open a second
  // way into the boosters' screen through the parents' form.
  if (isAdminCredentialAccount(user.email)) {
    return fail(
      'The boosters’ screen signs in with ADMIN_PASSWORD, not with this row. Change it in the deployment environment instead.',
      409
    );
  }

  const password = await resetPassword(user.id);
  record(req, 'password-reset', { userId: user.id, email: user.email });

  return ok({ password });
});
