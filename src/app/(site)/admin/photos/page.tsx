import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { listLibraries } from '@/lib/admin';
import { MAX_LIBRARY_PHOTOS } from '@/lib/config';

export const metadata = { title: 'Admin · Photos' };
export const dynamic = 'force-dynamic';

/** How many thumbnails each account shows before "open the library". */
const PREVIEW = 8;

export default async function AdminPhotosPage() {
  const user = await currentUser();
  if (!user?.is_admin) return null;

  const libraries = listLibraries(PREVIEW);
  const photos = libraries.reduce((n, l) => n + l.count, 0);
  const empty = libraries.filter((l) => l.count === 0).length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Photo libraries</h2>
          <div className="hint" style={{ marginTop: 2 }}>
            {photos} photo{photos === 1 ? '' : 's'} across {libraries.length} account
            {libraries.length === 1 ? '' : 's'}
            {empty > 0 && ` · ${empty} empty`}
          </div>
        </div>
      </div>

      <div className="stack">
        {libraries.map((lib) => (
          <div className="card" key={lib.userId}>
            <div className="spread" style={{ marginBottom: lib.count ? 12 : 0 }}>
              <div>
                <strong>{lib.name || lib.email}</strong>
                {lib.isAdmin && (
                  <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                    Boosters
                  </span>
                )}
                <div className="hint" style={{ marginTop: 2 }}>
                  {lib.name ? `${lib.email} · ` : ''}
                  {lib.count} of {MAX_LIBRARY_PHOTOS} photos
                </div>
              </div>
              <Link className="btn btn-sm btn-secondary" href={`/admin/photos/${lib.userId}`}>
                {lib.count ? 'Open library' : 'Add photos'}
              </Link>
            </div>

            {lib.count > 0 && (
              <div className="photo-strip">
                {lib.recent.map((p) => (
                  <Link key={p.id} href={`/admin/photos/${lib.userId}`} title={p.origName}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.origName} loading="lazy" />
                  </Link>
                ))}
                {lib.count > lib.recent.length && (
                  <Link className="photo-strip-more" href={`/admin/photos/${lib.userId}`}>
                    +{lib.count - lib.recent.length}
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}

        {libraries.length === 0 && (
          <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
            Nobody has signed up yet.
          </div>
        )}
      </div>

      <div className="hint" style={{ marginTop: 10 }}>
        You can add photos to any of these — useful when a parent sends the boosters their
        pictures instead of uploading them — and remove one, as long as no ad is still using it.
      </div>
    </>
  );
}
