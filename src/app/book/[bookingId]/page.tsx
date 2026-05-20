import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays, waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import { CopyButton } from './CopyButton'
import './confirmed.css'

export const metadata: Metadata = {
  title: 'Booking Confirmed — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  if (min < 60) return `${min} min`
  return min % 60 === 0 ? `${min / 60} hr` : `${(min / 60).toFixed(1)} hr`
}

export default async function BookingConfirmedPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const now = new Date()

  const [[booking], [latestWaiver]] = await Promise.all([
    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
        bayLabel: bays.label,
        totalCents: bookings.totalCents,
        partySize: bookings.partySize,
      })
      .from(bookings)
      .leftJoin(bays, eq(bookings.bayId, bays.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
      .limit(1),

    db
      .select({ expiresAt: waiverSignings.expiresAt })
      .from(waiverSignings)
      .where(and(eq(waiverSignings.userId, session.user.id), gt(waiverSignings.expiresAt, now)))
      .orderBy(desc(waiverSignings.signedAt))
      .limit(1),
  ])

  if (!booking) redirect('/account')
  const hasWaiver = !!latestWaiver

  const confirmationNum = `SPC-${bookingId.slice(0, 6).toUpperCase()}-${bookingId.slice(-4).toUpperCase()}`

  return (
    <div className="conf-page">
      <div className="conf-wrap">

        {/* ── Left: success message + what happens next ───────────────────── */}
        <div className="conf-main">
          <div className="conf-check">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="24" cy="24" r="22"/>
              <path d="M14 24l8 8 14-16"/>
            </svg>
          </div>

          <h1 className="conf-heading">Booking Confirmed</h1>
          <p className="conf-intro">
            Your reservation has been confirmed.<br/>We look forward to seeing you!
          </p>

          {/* Confirmation number */}
          <div className="conf-number-card">
            <div>
              <p className="conf-number-label">CONFIRMATION NUMBER</p>
              <p className="conf-number-value">{confirmationNum}</p>
            </div>
            <CopyButton text={confirmationNum} />
          </div>

          {/* What happens next */}
          <div className="conf-next">
            <p className="conf-section-label">WHAT HAPPENS NEXT</p>

            <div className="conf-next-item">
              <div className="conf-next-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="16" height="12" rx="2"/>
                  <path d="M2 6l8 6 8-6"/>
                </svg>
              </div>
              <div>
                <p className="conf-next-title">Bay &amp; Access Code</p>
                <p className="conf-next-body">
                  You&apos;ll be assigned a bay and sent a one-time access code 1 hour before your session, by email and text message.
                </p>
              </div>
            </div>

            <div className="conf-next-item">
              <div className="conf-next-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="7" r="3"/>
                  <path d="M3 18a7 7 0 0114 0"/>
                </svg>
              </div>
              <div>
                {hasWaiver ? (
                  <>
                    <p className="conf-next-title">Waivers Required</p>
                    <p className="conf-next-body">
                      All players must have a signed waiver on file. Guests will receive a link to complete theirs.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="conf-next-title">Sign Your Waiver</p>
                    <p className="conf-next-body">
                      You don&apos;t have an active waiver on file. A signed waiver is required before your session.{' '}
                      <a href="/waiver" style={{ color: '#A97845', textDecoration: 'underline' }}>Sign it now →</a>
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="conf-next-item">
              <div className="conf-next-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <rect x="3" y="4" width="14" height="13" rx="2"/>
                  <path d="M7 2v4M13 2v4M3 9h14"/>
                </svg>
              </div>
              <div>
                <p className="conf-next-title">Arrive Early</p>
                <p className="conf-next-body">
                  We recommend arriving 10–15 minutes early to check in and get set up.
                </p>
              </div>
            </div>
          </div>

          {/* Buttons (mobile shows here, desktop shows on side) */}
          <div className="conf-actions conf-actions-mobile">
            <a href={`/account/bookings/${bookingId}`} className="conf-btn primary">
              View Booking
            </a>
            <a href={`/api/book/${bookingId}/ics`} download className="conf-btn ghost">
              Add to Calendar
            </a>
            <a href={`/book/${bookingId}/guests`} className="conf-btn ghost">
              Add Guests
            </a>
          </div>

          <p className="conf-footer-note">A confirmation email has been sent to you.</p>
        </div>

        {/* ── Right: booking summary ──────────────────────────────────────── */}
        <aside className="conf-aside">
          <div className="conf-summary">
            <p className="conf-section-label">YOUR BOOKING</p>

            <div className="conf-summary-row">
              <span className="conf-summary-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <rect x="3" y="4" width="14" height="13" rx="2"/>
                  <path d="M7 2v4M13 2v4M3 9h14"/>
                </svg>
              </span>
              <div>
                <p className="conf-summary-label">Date</p>
                <p className="conf-summary-value">
                  {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE, MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="conf-summary-row">
              <span className="conf-summary-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <circle cx="10" cy="10" r="7"/>
                  <path d="M10 6v4l2.5 2.5"/>
                </svg>
              </span>
              <div>
                <p className="conf-summary-label">Time</p>
                <p className="conf-summary-value">
                  {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                  {formatInTimeZone(booking.endsAt, FACILITY_TZ, 'h:mm a')}
                </p>
              </div>
            </div>

            <div className="conf-summary-row">
              <span className="conf-summary-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h8M6 17h8M7 3v3l3 3-3 3v3M13 3v3l-3 3 3 3v3"/>
                </svg>
              </span>
              <div>
                <p className="conf-summary-label">Duration</p>
                <p className="conf-summary-value">{durationLabel(booking.startsAt, booking.endsAt)}</p>
              </div>
            </div>

            <div className="conf-summary-row">
              <span className="conf-summary-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <circle cx="7" cy="7" r="3"/>
                  <path d="M2 17a5 5 0 0110 0"/>
                  <circle cx="14" cy="8" r="2.5"/>
                </svg>
              </span>
              <div>
                <p className="conf-summary-label">Players</p>
                <p className="conf-summary-value">{booking.partySize || 1} Player{booking.partySize !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="conf-total-row">
              <span className="conf-total-label">Total</span>
              <span className="conf-total-value">
                {booking.totalCents > 0 ? `$${(booking.totalCents / 100).toFixed(2)}` : 'Free'}
              </span>
            </div>
          </div>

          <div className="conf-actions conf-actions-desktop">
            <a href={`/account/bookings/${bookingId}`} className="conf-btn primary">
              View Booking
            </a>
            <a href={`/api/book/${bookingId}/ics`} download className="conf-btn ghost">
              Add to Calendar
            </a>
            <a href={`/book/${bookingId}/guests`} className="conf-btn ghost">
              Add Guests
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
