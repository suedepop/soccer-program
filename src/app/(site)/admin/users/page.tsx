import AdminUsersTable from '@/components/AdminUsersTable';
import { listUsers } from '@/lib/admin';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Admin · Users' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await currentUser();
  if (!user?.is_admin) return null;

  const users = listUsers();
  const parents = users.filter((u) => !u.isAdmin);
  const neverIn = parents.filter((u) => !u.lastLoginAt).length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Accounts</h2>
          <div className="hint" style={{ marginTop: 2 }}>
            {parents.length} parent account{parents.length === 1 ? '' : 's'}
            {neverIn > 0 && ` · ${neverIn} have never signed in`}
          </div>
        </div>
      </div>

      <AdminUsersTable users={users} />
    </>
  );
}
