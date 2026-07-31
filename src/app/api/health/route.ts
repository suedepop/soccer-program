import { db } from '@/lib/db';

/**
 * Liveness for Docker's HEALTHCHECK and the deploy workflow.
 *
 * It opens the database on purpose: a container that is running but pointed at
 * an empty DATA_DIR is the failure this whole app is most afraid of, and it
 * should not pass a health check. Says nothing else — it answers without a
 * session.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  db().prepare('SELECT 1').get();
  return Response.json({ ok: true });
}
