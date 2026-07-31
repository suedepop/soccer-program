import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { SCHOOL } from '@/lib/config';
import LogoutButton from '@/components/LogoutButton';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/">
            {/* The school's W is drawn in black and red, and the bar it sits on
                is nearly black — hence the light chip behind it. Recolouring the
                mark to fit the bar would mean throwing away the red. */}
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/fonts/logo/weir-high-logo.png"
                alt=""
                aria-hidden
                width={1280}
                height={606}
              />
            </span>
            {SCHOOL.program}
          </Link>
          <nav className="nav-links">
            {user ? (
              <>
                <Link href="/dashboard">My Ads</Link>
                <Link href="/photos">Photos</Link>
                <Link href="/ads/new">Create an Ad</Link>
                {/*
                  No Admin link on purpose — the boosters reach the admin screen
                  by typing /admin, which asks for its own password. Keeping it
                  out of the nav means parents never see a door they cannot open.
                */}
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login">Sign In</Link>
                <Link href="/signup">Create Account</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <div className="wrap">
          <div className="spread">
            <div>
              {SCHOOL.contactName} · {SCHOOL.season}
              <br />
              Questions? <a href={`mailto:${SCHOOL.contactEmail}`}>{SCHOOL.contactEmail}</a>
            </div>
            <div>Go {SCHOOL.mascot}!</div>
          </div>
        </div>
      </footer>
    </>
  );
}
