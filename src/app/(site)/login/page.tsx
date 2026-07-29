import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Sign In' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentUser()) redirect('/dashboard');

  return (
    <div className="wrap-narrow page">
      <h1>Sign in</h1>
      <p style={{ color: 'var(--muted)' }}>
        Pick up where you left off, or check the status of an ad you already submitted.
      </p>
      <AuthForm mode="login" />
    </div>
  );
}
