import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminUserPhotos from '@/components/AdminUserPhotos';
import { currentUser, findUserById } from '@/lib/auth';

export const metadata = { title: 'Admin · Photo Library' };
export const dynamic = 'force-dynamic';

export default async function AdminUserPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user?.is_admin) return null;

  const { id } = await params;
  const target = findUserById(Number(id));
  if (!target) notFound();

  const who = target.name || target.email;

  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{who}’s photos</h2>
          <div className="hint" style={{ marginTop: 2 }}>
            <a href={`mailto:${target.email}`}>{target.email}</a>
            {target.phone && ` · ${target.phone}`}
          </div>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/admin/photos">
          ← All libraries
        </Link>
      </div>

      <AdminUserPhotos userId={target.id} who={who} />
    </>
  );
}
