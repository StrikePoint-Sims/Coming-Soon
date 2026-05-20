import { auth } from '@/auth'
import { LoginForm } from '@/components/auth/LoginForm'
import { env } from '@/env'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Sign In — StrikePoint Sims',
  robots: { index: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; plan?: string; billing?: string }>
}) {
  const params = await searchParams
  const session = await auth()

  if (session?.user?.id) {
    if (params.plan) {
      const billing = params.billing === 'annual' ? 'annual' : 'monthly'
      redirect(`/memberships/checkout?plan=${encodeURIComponent(params.plan)}&billing=${billing}`)
    }
    if (params.callbackUrl) redirect(safeCallbackUrl(params.callbackUrl) as never)
    redirect('/account')
  }

  return (
    <LoginForm
      callbackUrl={params.callbackUrl}
      showGoogle={!!env.GOOGLE_CLIENT_ID}
      showApple={!!env.APPLE_ID}
    />
  )
}

function safeCallbackUrl(raw: string): string {
  try {
    const url = new URL(raw, 'https://www.strikepointsims.com')
    if (url.origin !== 'https://www.strikepointsims.com') return '/account'
    return `${url.pathname}${url.search}${url.hash}` || '/account'
  } catch {
    return '/account'
  }
}
