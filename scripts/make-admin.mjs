#!/usr/bin/env node
/**
 * Grant (or revoke) admin on an existing account.
 *
 *   npm run seed:admin -- someone@example.com
 *   npm run seed:admin -- someone@example.com --revoke
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const email = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!email) {
  console.error('Usage: npm run seed:admin -- <email> [--revoke]');
  process.exit(1);
}

const file = path.join(path.resolve(process.env.DATA_DIR || './data'), 'program.sqlite');
const db = new Database(file);

const info = db
  .prepare('UPDATE users SET is_admin = ? WHERE email = ?')
  .run(revoke ? 0 : 1, email.toLowerCase());

if (info.changes === 0) {
  console.error(`No account found for ${email}. Sign up on the site first.`);
  process.exit(1);
}

console.log(`${email} is ${revoke ? 'no longer' : 'now'} an admin.`);

const rows = db.prepare('SELECT email FROM users WHERE is_admin = 1 ORDER BY email').all();
console.log('Current admins:', rows.map((r) => r.email).join(', ') || '(none)');
