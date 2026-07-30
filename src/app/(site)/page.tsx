import Link from 'next/link';
import AdCanvas from '@/components/AdCanvas';
import { currentUser } from '@/lib/auth';
import { AD_SIZES, AD_SIZE_ORDER, SCHOOL, formatMoney } from '@/lib/config';
import { BACKGROUNDS } from '@/lib/backgrounds';
import { layoutsFor } from '@/lib/layouts';

export const dynamic = 'force-dynamic';

const SAMPLE = {
  playerName: 'Kylie Marsh',
  message:
    'Kylie, we have loved watching you play over the years and can’t wait to see what the future holds. Keep smiling on and off the field — you are a joy to watch.',
  attribution: 'Love, Mom, Dad, and Jen',
  photos: [],
};

export default async function HomePage() {
  const user = await currentUser();

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="kicker" style={{ color: '#ff9aab' }}>
            {SCHOOL.season} · Boys &amp; Girls Soccer
          </div>
          <h1>Put your player in the program</h1>
          <p>
            Every {SCHOOL.mascot} home match, families page through the program looking for their
            player. Reserve a congratulations ad, write your message, pick a design, and we’ll
            print it. Ads are due <strong>{SCHOOL.deadline}</strong>.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link className="btn btn-lg" href={user ? '/ads/new' : '/signup'}>
              {user ? 'Create an Ad' : 'Get Started'}
            </Link>
            {!user && (
              <Link className="btn btn-lg btn-secondary" href="/login">
                I already have an account
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="wrap page">
        <h2>Choose your size</h2>
        <div className="pricing">
          {AD_SIZE_ORDER.map((id) => {
            const spec = AD_SIZES[id];
            return (
              <div className="card" key={id}>
                <div className="spread" style={{ alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0 }}>{spec.label}</h3>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>
                    {formatMoney(spec.priceCents)}
                  </div>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{spec.blurb}</p>
                <ul style={{ fontSize: 13.5, paddingLeft: 18, color: 'var(--ink-2)' }}>
                  <li>
                    {spec.widthIn}&Prime; × {spec.heightIn}&Prime; finished size
                  </li>
                  <li>
                    Up to {spec.maxPhotos} photo{spec.maxPhotos > 1 ? 's' : ''}
                  </li>
                  <li>{layoutsFor(id).length} layouts to choose from</li>
                </ul>
                <Link className="btn btn-secondary" href={user ? '/ads/new' : '/signup'}>
                  Start a {spec.label}
                </Link>
              </div>
            );
          })}
        </div>

        <h2 style={{ marginTop: 40 }}>Pick a background</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 640 }}>
          {BACKGROUNDS.length} designs in the {SCHOOL.mascot} red, black, and white. Every layout
          works with every background, so mix and match until it looks right.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 14,
          }}
        >
          {BACKGROUNDS.slice(0, 6).map((bg) => (
            <div key={bg.id}>
              <div
                style={{
                  transform: 'scale(1)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--line)',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <AdCanvas
                  ad={{
                    ...SAMPLE,
                    size: 'quarter',
                    layoutId: 'q-photo-top',
                    backgroundId: bg.id,
                  }}
                  scale={0.36}
                />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{bg.name}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 36 }}>
          <h3>How it works</h3>
          <ol style={{ paddingLeft: 20, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            <li>Create an account so you can come back and edit — or order more than one.</li>
            <li>Pick a size, a layout, and a background. Upload your photos.</li>
            <li>Preview it, then submit. Your ad shows as <strong>Payment Due</strong>.</li>
            <li>
              Send payment to the boosters. Once it clears, we mark the ad <strong>Paid</strong> and
              it’s locked in for print.
            </li>
          </ol>
          <div className="notice notice-info" style={{ marginTop: 12 }}>
            <strong>Payment is handled off the website.</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {SCHOOL.paymentInstructions.map((line, i) => (
                <li
                  key={i}
                  // Keeps the newlines in the mailing address without turning
                  // config.ts into markup.
                  style={{ whiteSpace: 'pre-line' }}
                  dangerouslySetInnerHTML={{ __html: bold(line) }}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

/** Tiny **bold** helper so booster contact details stay editable in config.ts. */
function bold(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
