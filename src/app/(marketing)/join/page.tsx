import './join.css'
import { FounderForm } from '@/components/marketing/FounderForm'
import { env } from '@/env'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reserve a Founding Spot | StrikePoint Sims | Opening Fall 2026',
  description:
    'Reserve one of 20 Founding spots at StrikePoint Sims. Lock in monthly savings for life. Card saved at signup, charged when we open. Opening Fall 2026 in Colchester, CT.',
  alternates: { canonical: 'https://www.strikepointsims.com/join' },
  openGraph: {
    title: 'Reserve a Founding Spot | StrikePoint Sims',
    description: '20 spots. Founding savings locked for life. Card saved, charged when we open.',
    url: 'https://www.strikepointsims.com/join',
    images: [{ url: 'https://www.strikepointsims.com/og-image.jpg' }],
  },
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ updates?: string; mode?: string }>
}) {
  const params = await searchParams
  const initialMode = params.updates === '1' || params.mode === 'updates' ? 'updates' : 'founder'

  return (
    <FounderForm stripePublishableKey={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''} initialMode={initialMode} />
  )
}
