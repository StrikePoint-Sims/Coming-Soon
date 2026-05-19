import { db } from '@/db'
import { bookingGuests, waiverSignings, bookings } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { WAIVER_CONTENT } from '@/lib/waivers/content'
import { signGuestWaiver } from './actions'
import { hashGuestToken } from '@/lib/waivers/guest-links'
import { formatDateET } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Waiver — StrikePoint Sims',
  robots: { index: false },
}

export default async function GuestWaiverPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Token is opaque and random. We look up by its hash; the row primary key is
  // not an accepted credential.
  const tokenHash = hashGuestToken(token)
  const [guest] = await db
    .select()
    .from(bookingGuests)
    .where(eq(bookingGuests.accessTokenHash, tokenHash))
    .limit(1)

  if (!guest) notFound()

  // Check if already signed
  const [existing] = await db
    .select({ signedAt: waiverSignings.signedAt, expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.tokenHash, tokenHash), gt(waiverSignings.expiresAt, new Date())))
    .limit(1)

  if (existing) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-6">✓</div>
          <h1 className="font-['Playfair_Display'] text-2xl font-semibold text-white mb-3">
            Waiver already signed
          </h1>
          <p className="text-sm text-[rgba(255,255,255,0.55)] leading-relaxed">
            You&apos;re all set. Your waiver is valid until {formatDateET(existing.expiresAt)}.
          </p>
        </div>
      </main>
    )
  }

  // Look up booking for context
  const [booking] = await db
    .select({ startsAt: bookings.startsAt })
    .from(bookings)
    .where(eq(bookings.id, guest.bookingId))
    .limit(1)

  const W = WAIVER_CONTENT

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-b border-[rgba(255,255,255,0.06)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logohorizontal.png" alt="StrikePoint Sims" className="h-12" />
      </div>

      <div className="max-w-3xl mx-auto px-5 py-12 pb-24">
        {/* Context banner */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-4 mb-10 flex gap-3 items-start">
          <span className="text-xl mt-0.5">⛳</span>
          <div>
            <p className="text-sm font-semibold text-white mb-0.5">
              You&apos;ve been invited to a StrikePoint Sims session
              {booking ? ` on ${formatDateET(booking.startsAt)}` : ''}
            </p>
            <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed">
              All participants must sign a waiver before entering a bay. This takes about 2 minutes.
            </p>
          </div>
        </div>

        <span className="text-xs font-bold uppercase tracking-widest text-[#8fa65e] mb-4 block">
          Legal
        </span>
        <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-white mb-2">
          {W.title}
        </h1>
        <p className="text-sm text-[rgba(255,255,255,0.45)] mb-1">
          {W.entity} · Last Updated: {W.lastUpdated}
        </p>
        <p className="text-sm font-bold text-[rgba(255,255,255,0.85)] mb-10">{W.preamble}</p>
        <p className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed mb-12">{W.intro}</p>

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
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-white mb-6">
            Sign to confirm
          </h2>
          <form action={signGuestWaiver} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.5)]">
                Type your full name as your signature
              </label>
              <input
                type="text"
                name="signatureText"
                placeholder="Your full name"
                required
                minLength={2}
                className="h-11 w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1a1a1a] px-4 text-sm text-white font-['Playfair_Display'] italic placeholder:text-[rgba(255,255,255,0.25)] focus:border-[#A97845] focus:outline-none focus:ring-1 focus:ring-[#A97845]"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="agreed" required className="mt-0.5 h-4 w-4 rounded accent-[#A97845]" />
              <span className="text-sm text-[rgba(255,255,255,0.65)] leading-relaxed">
                I have read this entire Waiver and agree to its terms. Valid for 12 months.
              </span>
            </label>

            <button
              type="submit"
              className="w-full h-12 rounded-lg bg-[#1B4332] text-[#A97845] border border-[#A97845] font-semibold text-sm hover:bg-[#2a5c46] transition-colors"
            >
              Sign waiver
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
