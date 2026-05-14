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
    <div>
      <div className="mb-8 text-center">
        <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-white mb-2">
          Sign in
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.55)]">
          Enter your email or phone number to continue
        </p>
      </div>
      <LoginForm searchParams={searchParams} />
    </div>
  )
}
