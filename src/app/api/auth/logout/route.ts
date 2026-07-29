import { destroySession } from '@/lib/auth';
import { handler, ok } from '@/lib/http';

export const POST = handler(async () => {
  await destroySession();
  return ok({ ok: true });
});
