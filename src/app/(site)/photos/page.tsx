import Link from 'next/link';
import { redirect } from 'next/navigation';
import PhotoLibrary from '@/components/PhotoLibrary';
import { currentUser } from '@/lib/auth';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';

export const metadata = { title: 'Photo Library' };
export const dynamic = 'force-dynamic';

export default async function PhotosPage() {
  if (!(await currentUser())) redirect('/login');

  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Photo library</h1>
          <p style={{ color: 'var(--muted)', margin: 0, maxWidth: 640 }}>
            Keep up to {MAX_LIBRARY_PHOTOS} photos here and pick from them while building an ad.
            The same picture can appear in as many ads as you like — you only upload it once.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/dashboard">
          ← All my ads
        </Link>
      </div>

      <PhotoLibrary />
    </div>
  );
}
