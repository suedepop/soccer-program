import AdminGate from '@/components/AdminGate';
import AdminNav from '@/components/AdminNav';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * The gate and the section nav, shared by every admin screen.
 *
 * Unlinked from the site nav and behind its own password: anyone can reach the
 * URL, but without an admin session all they get is the prompt. Parents who
 * wander in see it too, which is friendlier than the 404 this used to serve.
 *
 * Each page checks again for itself. A layout that declines to render its
 * children does not stop those children being *executed*, and the admin pages
 * read the whole database.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user?.is_admin) return <AdminGate />;

  return (
    <div className="wrap page">
      <h1 style={{ marginBottom: 10 }}>Admin</h1>
      <AdminNav />
      {children}
    </div>
  );
}
