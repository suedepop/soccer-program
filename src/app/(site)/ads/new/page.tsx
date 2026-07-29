import { redirect } from 'next/navigation';
import SizePicker from '@/components/SizePicker';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Create an Ad' };
export const dynamic = 'force-dynamic';

export default async function NewAdPage() {
  if (!(await currentUser())) redirect('/login');

  return (
    <div className="wrap page">
      <h1>Pick a size</h1>
      <p style={{ color: 'var(--muted)', maxWidth: 620 }}>
        You can change the layout, background, photos, and wording afterwards — but not the size,
        so start here. Nothing is charged until you submit, and payment happens off the site.
      </p>
      <SizePicker />
    </div>
  );
}
