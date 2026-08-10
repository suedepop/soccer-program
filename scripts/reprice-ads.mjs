#!/usr/bin/env node
/**
 * Re-prices existing ads to the current prices in src/lib/config.ts.
 *
 * An ad stores the price it was created at, so changing AD_SIZES only affects
 * ads made from then on. Run this after a price change to bring the ones
 * already in the database into line.
 *
 *   npm run reprice                     # show what would change, touch nothing
 *   npm run reprice -- --apply          # actually write
 *   npm run reprice -- --apply --unpaid-only   # leave 'paid' ads at what was collected
 *
 * Point DATA_DIR at the database you mean to change — the same absolute path
 * the app runs with. Without it this edits ./data, which in a checkout is your
 * development copy, not production.
 *
 * Prices are read from the config rather than repeated here, so this script
 * never needs editing when they change.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { AD_SIZES, formatMoney } from '../src/lib/config.ts';

const apply = process.argv.includes('--apply');
const unpaidOnly = process.argv.includes('--unpaid-only');

const file = path.join(path.resolve(process.env.DATA_DIR || './data'), 'program.sqlite');
console.log(`Database: ${file}`);

const db = new Database(file);

// Group the work by (size, old price) so the report is a short list of price
// moves rather than one line per ad.
const groups = db
  .prepare(
    `SELECT size, price_cents AS old_cents, status, COUNT(*) AS n
       FROM ads
      GROUP BY size, price_cents, status
      ORDER BY size, price_cents, status`
  )
  .all();

const changes = [];
const skipped = [];

for (const g of groups) {
  const spec = AD_SIZES[g.size];
  if (!spec) {
    // A size that is no longer offered has no current price to move it to.
    skipped.push({ ...g, why: `unknown size '${g.size}'` });
    continue;
  }
  if (g.old_cents === spec.priceCents) continue;
  if (unpaidOnly && g.status === 'paid') {
    skipped.push({ ...g, why: 'already paid' });
    continue;
  }
  changes.push({ ...g, new_cents: spec.priceCents, label: spec.label });
}

if (skipped.length) {
  console.log('\nLeaving alone:');
  for (const s of skipped) {
    console.log(`  ${s.n} × ${s.size} @ ${formatMoney(s.old_cents)} (${s.status}) — ${s.why}`);
  }
}

if (!changes.length) {
  console.log('\nEvery ad is already at the current price. Nothing to do.');
  process.exit(0);
}

console.log(`\n${apply ? 'Re-pricing' : 'Would re-price'}:`);
let total = 0;
for (const c of changes) {
  console.log(
    `  ${String(c.n).padStart(3)} × ${c.label.padEnd(12)} ` +
      `${formatMoney(c.old_cents)} → ${formatMoney(c.new_cents)}  (${c.status})`
  );
  total += c.n;
}

if (!apply) {
  console.log(`\n${total} ad${total === 1 ? '' : 's'} would change. Re-run with --apply to write.`);
  process.exit(0);
}

// One transaction: a half-applied price change is worse than none at all.
// updated_at is deliberately left alone — this is a booster changing the price
// list, not the parent editing their ad, and it should not read as one.
const stmt = db.prepare(
  `UPDATE ads SET price_cents = ?
     WHERE size = ? AND price_cents = ? AND status = ?`
);
const run = db.transaction((rows) => {
  let n = 0;
  for (const c of rows) n += stmt.run(c.new_cents, c.size, c.old_cents, c.status).changes;
  return n;
});
const written = run(changes);

console.log(`\nUpdated ${written} ad${written === 1 ? '' : 's'}.`);

const after = db
  .prepare('SELECT size, price_cents, COUNT(*) AS n FROM ads GROUP BY size, price_cents ORDER BY size')
  .all();
console.log('\nNow in the database:');
for (const r of after) {
  console.log(`  ${String(r.n).padStart(3)} × ${r.size.padEnd(8)} @ ${formatMoney(r.price_cents)}`);
}
