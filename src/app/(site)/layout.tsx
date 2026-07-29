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
            <span className="brand-mark" aria-hidden>
              ⚽
            </span>
            {SCHOOL.program}
          </Link>
          <nav className="nav-links">
            {user ? (
              <>
                <Link href="/dashboard">My Ads</Link>
                <Link href="/ads/new">Create an Ad</Link>
                {!!user.is_admin && <Link href="/admin">Admin</Link>}
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
