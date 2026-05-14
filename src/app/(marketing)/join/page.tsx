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

export default function JoinPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: '#0a0a0a', color: '#fff', fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 40px',
          background: 'rgba(10,10,10,0.88)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logohorizontal.png" alt="StrikePoint Sims" style={{ height: 36, opacity: 0.92 }} />
        <a href="/" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
          ← Home
        </a>
      </header>

      <div style={{ paddingTop: 100, maxWidth: 680, margin: '0 auto', padding: '112px 32px 80px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#c9a84c', display: 'block', marginBottom: 20 }}>
          Founding Member
        </span>
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: 20,
          }}
        >
          Reserve your founding spot
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.65, marginBottom: 12 }}>
          We&apos;re reserving 20 founding memberships for early supporters. Lock in founding pricing for as long as you&apos;re a member.
        </p>
        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.6 }}>
          Your card is saved today. You won&apos;t be charged until we open — and you can cancel at any time before that.
        </p>

        <FounderForm stripePublishableKey={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} />
      </div>
    </main>
  )
}
