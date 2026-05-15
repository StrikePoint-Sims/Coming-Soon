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
  return <LoginForm searchParams={searchParams} />
}
