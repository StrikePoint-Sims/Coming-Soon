import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, bays, waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import '../../account.css'

export const metadata: Metadata = {
  title: 'Manage Booking — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  return min % 60 === 0 ? `${min / 60} hr` : `${(min / 60).toFixed(1)} hr`
}

function statusLabel(s: string): string {
  if (s === 'checked_in') return 'Checked In'
  if (s === 'no_show') return 'No Show'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusClass(s: string): string {
  if (s === 'confirmed' || s === 'checked_in') return 'confirmed'
  if (s === 'completed') return 'completed'
  if (s === 'pending') return 'pending'
  return 'cancelled'
}

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      bayLabel: bays.label,
      status: bookings.status,
      totalCents: bookings.totalCents,
      partySize: bookings.partySize,
      paidAt: bookings.paidAt,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, id), eq(bookings.userId, user.id)))
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!booking) redirect('/account/bookings' as any)

  const now = new Date()
  const isFuture = booking.startsAt > now
  const isCancellable = isFuture && booking.status !== 'cancelled'

  const [waiver] = await db
    .select({ expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  const confirmationNum = `SPC-${id.slice(0, 6).toUpperCase()}-${id.slice(-4).toUpperCase()}`

  return (
    <div className="dash-page">
      {/* Header with back link */}
      <a href="/account/bookings" className="mb-back">
        <span className="mb-back-arrow">‹</span> My Bookings
      </a>

      <div className="dash-header" style={{ marginTop: 8 }}>
        <h1 className="dash-title">Manage Booking</h1>
        <p className="dash-subtitle">View your reservation and make changes.</p>
      </div>

      {/* ── Current Reservation card ────────────────────────────────────── */}
      <div className="dash-section-card">
        <div className="dash-section-header">
          <span className="dash-section-label gold">CURRENT RESERVATION</span>
          <span className={`dash-status ${statusClass(booking.status)}`}>
            {statusLabel(booking.status)}
          </span>
        </div>

        <div className="mb-res-grid">
          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="3" y="4" width="14" height="13" rx="2"/>
                <path d="M7 2v4M13 2v4M3 9h14"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Date</p>
              <p className="mb-res-value">
                {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE, MMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="10" cy="10" r="7"/>
                <path d="M10 6v4l2.5 2.5"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Time</p>
              <p className="mb-res-value">
                {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                {formatInTimeZone(booking.endsAt, FACILITY_TZ, 'h:mm a')}
              </p>
            </div>
          </div>

          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h8M6 17h8M7 3v3l3 3-3 3v3M13 3v3l-3 3 3 3v3"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Duration</p>
              <p className="mb-res-value">{durationLabel(booking.startsAt, booking.endsAt)}</p>
            </div>
          </div>

          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7" cy="7" r="3"/>
                <path d="M2 17a5 5 0 0110 0"/>
                <circle cx="14" cy="8" r="2.5"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Players</p>
              <p className="mb-res-value">{booking.partySize || 1} Player{booking.partySize !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="2" y="3" width="16" height="14" rx="2"/>
                <path d="M2 7h16"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Bay</p>
              <p className="mb-res-value">{booking.bayLabel}</p>
            </div>
          </div>

          <div className="mb-res-item">
            <div className="mb-res-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="2" y="5" width="16" height="11" rx="2"/>
                <path d="M2 9h16"/>
              </svg>
            </div>
            <div>
              <p className="mb-res-label">Total</p>
              <p className="mb-res-value">
                {booking.totalCents > 0 ? `$${(booking.totalCents / 100).toFixed(2)}` : 'Free'}
                {booking.paidAt && <span className="mb-res-paid"> · Paid</span>}
              </p>
            </div>
          </div>
        </div>

        <p className="mb-conf-num">
          Confirmation: <span>{confirmationNum}</span>
        </p>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────── */}
      {isFuture && (
        <div className="mb-action-row">
          <a href="#change" className="dash-btn ghost mb-action">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="9" cy="9" r="7"/>
              <path d="M9 5v4l3 2"/>
            </svg>
            Change Time
          </a>
          <a href="/account/guests" className="dash-btn ghost mb-action">
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="7" cy="6" r="3"/>
              <path d="M2 16a5 5 0 0110 0"/>
              <path d="M13 7h3M14.5 5.5v3"/>
            </svg>
            Add Guests
          </a>
          {isCancellable && (
            <button className="dash-btn danger mb-action" type="button">
              <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 5h12M6 5V3a1 1 0 011-1h4a1 1 0 011 1v2M5 5l1 10h6l1-10"/>
              </svg>
              Cancel Booking
            </button>
          )}
        </div>
      )}

      {/* ── Waiver status ──────────────────────────────────────────────── */}
      <div className="dash-section-card">
        <div className="dash-section-header">
          <span className="dash-section-label gold">ACCESS &amp; WAIVER</span>
        </div>
        <div className="mb-waiver-row">
          <div className="mb-waiver-info">
            <p className="mb-waiver-label">Your Waiver</p>
            {waiver ? (
              <p className="mb-waiver-status valid">
                ✓ Valid until {formatInTimeZone(waiver.expiresAt, FACILITY_TZ, 'MMM d, yyyy')}
              </p>
            ) : (
              <p className="mb-waiver-status invalid">No active waiver</p>
            )}
          </div>
          {!waiver && (
            <a href="/waiver" className="dash-btn ghost">Sign Waiver</a>
          )}
        </div>
        {isFuture && waiver && (
          <div className="mb-waiver-row" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 14, marginTop: 6 }}>
            <div className="mb-waiver-info">
              <p className="mb-waiver-label">Access Code</p>
              <p className="mb-waiver-status">Sent by SMS 1 hour before your session.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom CTAs ─────────────────────────────────────────────────── */}
      {isFuture ? (
        <div className="mb-bottom-actions">
          <a href={`/api/book/${booking.id}/ics`} download className="dash-btn ghost dash-btn-full">
            Add to Calendar
          </a>
          <a href="/book" className="dash-btn primary dash-btn-full">
            Book Another Session
          </a>
        </div>
      ) : (
        <a href="/book" className="dash-btn primary dash-btn-full">
          Book Again
        </a>
      )}
    </div>
  )
}
