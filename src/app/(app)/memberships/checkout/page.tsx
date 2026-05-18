import { auth } from '@/auth'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CheckoutClient } from './CheckoutClient'
import './checkout.css'

export const metadata: Metadata = {
  title: 'Membership Checkout - StrikePoint Sims',
  robots: { index: false },
}

export default async function MembershipCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>
}) {
  const params = await searchParams
  const session = await auth()

  const plan = params.plan ?? 'standard'
  const billing = params.billing ?? 'monthly'
  const callbackUrl = `/memberships/checkout?plan=${encodeURIComponent(plan)}&billing=${encodeURIComponent(billing)}`

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return <CheckoutClient plan={plan} billing={billing} />
}
