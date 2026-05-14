import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Waiver Signed — StrikePoint Sims',
  robots: { index: false },
}

export default function WaiverConfirmedPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-6">⛳</div>
        <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-white mb-3">
          You&apos;re all set
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-6">
          Your waiver has been signed and is on file for 12 months. Your access code will arrive by SMS 5 minutes before your session.
        </p>
        <a
          href="/"
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white underline underline-offset-2"
        >
          ← StrikePoint Sims
        </a>
      </div>
    </main>
  )
}
