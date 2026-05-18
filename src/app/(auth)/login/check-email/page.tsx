import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Check Your Email — StrikePoint Sims',
  robots: { index: false },
}

export default function CheckEmailPage() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(169, 120, 69,0.06)] border border-[rgba(169, 120, 69,0.25)]">
        <svg viewBox="0 0 32 32" fill="none" stroke="#A97845" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
          <rect x="4" y="7" width="24" height="18" rx="3"/>
          <path d="M4 10l12 9 12-9"/>
        </svg>
      </div>
      <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-white mb-3">
        Check your email
      </h1>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-8 max-w-xs mx-auto">
        We sent a sign-in link to your inbox. Click it to continue — the link expires in 24 hours.
      </p>
      <p className="text-xs text-[rgba(255,255,255,0.35)]">
        Didn&apos;t get it?{' '}
        <Link href="/login" className="text-[#A97845] hover:text-[#e6c651] transition-colors">
          Try again
        </Link>{' '}
        or check your spam folder.
      </p>
    </div>
  )
}
