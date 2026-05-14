import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { WAIVER_CONTENT } from '@/lib/waivers/content'
import { signWaiver } from './actions'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Waiver — StrikePoint Sims',
  robots: { index: false },
}

export default async function WaiverPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?callbackUrl=/waiver')

  const { callbackUrl } = await searchParams
  const W = WAIVER_CONTENT

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-b border-[rgba(255,255,255,0.06)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logohorizontal.png" alt="StrikePoint Sims" className="h-8" />
        <a href="/account" className="text-xs text-[rgba(255,255,255,0.45)] hover:text-white">
          ← Account
        </a>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-12 pb-24">
        <span className="text-xs font-bold uppercase tracking-widest text-[#8fa65e] mb-4 block">
          Legal
        </span>
        <h1 className="font-['Playfair_Display'] text-3xl md:text-4xl font-semibold text-white mb-2">
          {W.title}
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.45)] mb-1">
          {W.entity} · Last Updated: {W.lastUpdated}
        </p>
        <p className="text-sm font-bold text-[rgba(255,255,255,0.7)] mb-2">{W.subtitle}</p>
        <p className="text-sm font-bold text-[rgba(255,255,255,0.85)] mb-10">{W.preamble}</p>
        <p className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed mb-12">{W.intro}</p>

        {/* Sections */}
        <div className="space-y-8 mb-14">
          {W.sections.map((section) => (
            <div key={section.number} className="border-b border-[rgba(255,255,255,0.06)] pb-8 last:border-b-0">
              <h2 className="font-['Playfair_Display'] text-lg font-semibold text-white mb-3">
                {section.number}. {section.title}
              </h2>
              {section.body.map((para, i) => (
                <p key={i} className="text-sm text-[rgba(255,255,255,0.72)] leading-relaxed mb-2 whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* Signature form */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#111] p-6">
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-white mb-2">
            Participant Acknowledgment
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-6">
            By signing below, you confirm that you have read this entire Waiver, understand its terms, and agree to be bound by it.
          </p>

          <form action={signWaiver} className="space-y-5">
            <input type="hidden" name="callbackUrl" value={callbackUrl ?? '/account'} />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)]">
                Type your full name as your signature
              </label>
              <input
                type="text"
                name="signatureText"
                defaultValue={user.name ?? ''}
                placeholder={user.name ?? 'Your full name'}
                required
                minLength={2}
                className="h-11 w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1a1a1a] px-4 text-sm text-white font-['Playfair_Display'] italic placeholder:text-[rgba(255,255,255,0.25)] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <p className="text-xs text-[rgba(255,255,255,0.3)]">
                Signing on behalf of a minor? Type the minor&apos;s full name.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="agreed"
                required
                className="mt-0.5 h-4 w-4 rounded accent-[#D4AF37]"
              />
              <span className="text-sm text-[rgba(255,255,255,0.65)] leading-relaxed">
                I have read this entire Waiver, I understand that I am giving up substantial legal rights, and I agree to be bound by its terms. This signature applies to all future visits for the next 12 months.
              </span>
            </label>

            <div className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed">
              Signed as: <span className="text-[rgba(255,255,255,0.5)]">{user.email}</span>
              {' · '}Your IP address and timestamp will be recorded.
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-[#1B4332] text-[#D4AF37] border border-[#D4AF37] font-semibold text-sm hover:bg-[#2a5c46] transition-colors"
            >
              Sign waiver and continue
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
