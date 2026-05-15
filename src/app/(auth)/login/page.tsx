import { LoginForm } from '@/components/auth/LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — StrikePoint Sims',
  robots: { index: false },
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  return (
    <>
      <h1 className="auth-heading">Welcome back.</h1>
      <p className="auth-subhead">Sign in or create your account to continue.</p>
      <LoginForm searchParams={searchParams} />
    </>
  )
}
