'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LogoutButton from '@/components/LogoutButton';

/**
 * The site's links, as a row on a laptop and behind a hamburger on a phone.
 *
 * Four links plus the wordmark do not fit across 390px, and wrapping them made
 * the black bar a third of the screen before anyone had read anything.
 */
export default function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation, including the back button. Without this the panel
  // stays open over the page the parent just asked for, which reads as the tap
  // having done nothing.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? 'Close menu' : 'Menu'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden />
        <span aria-hidden />
        <span aria-hidden />
      </button>

      {/* Anything in here is a link or the sign-out button, so any tap should
          shut the panel — the pathname effect alone misses the case that looks
          most broken: tapping the link for the page you are already on. */}
      <nav
        id="site-menu"
        className={`nav-links${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
      >
        {signedIn ? (
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
    </>
  );
}
