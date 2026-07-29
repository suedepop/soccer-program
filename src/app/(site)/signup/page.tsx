import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { currentUser } from '@/lib/auth';
import { SCHOOL } from '@/lib/config';

export const metadata = { title: 'Create Account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await currentUser()) redirect('/dashboard');

  return (
    <div className="wrap-narrow page">
      <h1>Create your account</h1>
      <p style={{ color: 'var(--muted)' }}>
        An account lets you save a draft, order more than one ad, and check whether your payment
        has been recorded. Ads are due {SCHOOL.deadline}.
      </p>
      <AuthForm mode="signup" />
    </div>
  );
}
