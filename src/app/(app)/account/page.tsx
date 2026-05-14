import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { updateProfile, requestDataExport } from './actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateET } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account — StrikePoint Sims',
  robots: { index: false },
}

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [latestWaiver] = await db
    .select({ signedAt: waiverSignings.signedAt, expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, new Date())))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  const waiverExpired = !latestWaiver

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <a href="/" className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white">
            ← StrikePoint Sims
          </a>
          <h1 className="font-['Playfair_Display'] text-3xl font-semibold text-white mt-4">
            Your account
          </h1>
        </div>

        {/* Waiver status */}
        {waiverExpired && (
          <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4">
            <p className="text-sm text-amber-300 font-medium mb-1">Waiver required</p>
            <p className="text-xs text-amber-200/70 mb-3">
              You need a signed waiver on file before booking a bay.
            </p>
            <a
              href="/waiver"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 border border-amber-700/60 rounded-lg px-3 py-1.5 hover:bg-amber-900/40"
            >
              Sign waiver →
            </a>
          </div>
        )}

        {!waiverExpired && latestWaiver && (
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-0.5">
                Waiver
              </p>
              <p className="text-sm text-white">
                Valid — expires {formatDateET(latestWaiver.expiresAt)}
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-medium">✓ On file</span>
          </div>
        )}

        {/* Profile form */}
        <Card>
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-white mb-6">
            Profile
          </h2>
          <form action={updateProfile} className="space-y-4">
            <Input
              label="Full name"
              name="name"
              defaultValue={user.name ?? ''}
              placeholder="Your name"
              required
            />
            <Input
              label="Phone number"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ''}
              placeholder="+12035550100"
              hint="Used for booking reminders and access codes. US numbers only."
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.6)]">
                Dominant hand
              </label>
              <select
                name="handedness"
                defaultValue={user.handedness ?? ''}
                className="h-11 w-full rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1a1a1a] px-4 text-sm text-white focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              >
                <option value="">Not specified</option>
                <option value="right">Right</option>
                <option value="left">Left</option>
                <option value="ambidextrous">Ambidextrous</option>
              </select>
            </div>

            {/* Consent toggles */}
            <div className="border-t border-[rgba(255,255,255,0.06)] pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
                Communication preferences
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="marketingEmailConsent"
                  defaultChecked={user.marketingEmailConsent}
                  className="mt-0.5 h-4 w-4 rounded accent-[#D4AF37]"
                />
                <span className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed">
                  Marketing emails — news, promotions, league announcements
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="smsConsent"
                  defaultChecked={user.smsConsent}
                  className="mt-0.5 h-4 w-4 rounded accent-[#D4AF37]"
                />
                <span className="text-sm text-[rgba(255,255,255,0.7)] leading-relaxed">
                  SMS notifications — booking reminders, access codes, session alerts
                </span>
              </label>
              <p className="text-xs text-[rgba(255,255,255,0.3)] leading-relaxed">
                Transactional messages (access codes, receipts) are sent regardless of marketing preferences.
                Reply STOP to any SMS to opt out at any time.
              </p>
            </div>

            <Button type="submit" className="w-full">
              Save changes
            </Button>
          </form>
        </Card>

        {/* Data & privacy */}
        <Card>
          <h2 className="font-['Playfair_Display'] text-xl font-semibold text-white mb-4">
            Data & privacy
          </h2>
          <p className="text-sm text-[rgba(255,255,255,0.55)] leading-relaxed mb-4">
            You can request a copy of your data or delete your account at any time. Deletions are processed within 30 days.
          </p>
          <div className="flex gap-3">
            <form action={requestDataExport}>
              <Button type="submit" variant="ghost" size="sm">
                Export my data
              </Button>
            </form>
            <Button variant="danger" size="sm" disabled>
              Delete account
            </Button>
          </div>
          <p className="text-xs text-[rgba(255,255,255,0.3)] mt-3">
            Account deletion is currently handled by contacting us at{' '}
            <a href="mailto:operations@strikepointsims.com" className="text-[rgba(255,255,255,0.5)] underline underline-offset-2">
              operations@strikepointsims.com
            </a>
          </p>
        </Card>
      </div>
    </main>
  )
}
