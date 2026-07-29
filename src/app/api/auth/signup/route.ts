import { db } from '@/lib/db';
import { countUsers, createSession, findUserByEmail, hashPassword, normalizeEmail } from '@/lib/auth';
import { fail, handler, ok } from '@/lib/http';

export const POST = handler(async (req: Request) => {
  const body = (await req.json()) as Record<string, unknown>;
  const email = normalizeEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim().slice(0, 120);
  const phone = String(body.phone ?? '').trim().slice(0, 40);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Enter a valid email address.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (!name) return fail('Please tell us your name.');
  if (findUserByEmail(email)) return fail('An account already exists for that email. Try signing in.');

  // The very first account bootstraps the admin — see README.
  const isAdmin = countUsers() === 0 ? 1 : 0;

  const info = db()
    .prepare(
      'INSERT INTO users (email, password_hash, name, phone, is_admin) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email, await hashPassword(password), name, phone, isAdmin);

  await createSession(Number(info.lastInsertRowid));
  return ok({ id: Number(info.lastInsertRowid), isAdmin: !!isAdmin });
});
