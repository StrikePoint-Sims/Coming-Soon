import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Check Your Email — StrikePoint Sims',
  robots: { index: false },
}

export default function CheckEmailPage() {
  return (
    <div className="text-center">
      <div className="text-5xl mb-6">📬</div>
      <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-white mb-3">
        Check your email
      </h1>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-8">
        We sent a sign-in link to your email address. Click it to continue — the link expires in 24 hours.
      </p>
      <p className="text-xs text-[rgba(255,255,255,0.35)]">
        Didn&apos;t get it?{' '}
        <Link href="/login" className="text-[#D4AF37] underline underline-offset-2">
          Try again
        </Link>{' '}
        or check your spam folder.
      </p>
    </div>
  )
}
