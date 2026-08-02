'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/audit', label: 'Audit' },
];

/** The admin's own sections. Same chips as the pickers, so they scroll on a phone. */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="chip-row admin-nav" aria-label="Admin sections">
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="chip"
          // Exact match for the dashboard, which is a prefix of the others.
          aria-current={pathname === s.href ? 'page' : undefined}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
