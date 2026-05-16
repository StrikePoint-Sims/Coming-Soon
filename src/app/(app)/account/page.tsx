import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, bays, waiverSignings, memberships } from '@/db/schema'
import { eq, and, gt, lt, desc, inArray } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import './account.css'

export const metadata: Metadata = {
  title: 'Account — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

export default async function AccountOverviewPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()

  // Upcoming bookings (next 3)
  const upcomingBookings = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      bayLabel: bays.label,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(
      eq(bookings.userId, user.id),
      gt(bookings.startsAt, now),
      inArray(bookings.status, ['confirmed', 'pending', 'checked_in']),
    ))
    .orderBy(bookings.startsAt)
    .limit(3)

  // Active waiver check
  const [latestWaiver] = await db
    .select({ expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  // Active membership check
  const [activeMembership] = await db
    .select({ id: memberships.id, currentPeriodEnd: memberships.currentPeriodEnd })
    .from(memberships)
    .where(and(
      eq(memberships.userId, user.id),
      gt(memberships.currentPeriodEnd, now),
    ))
    .limit(1)

  const firstName = user.name?.split(' ')[0] ?? 'there'
  const waiverExpired = !latestWaiver
  const hasMembership = !!activeMembership

  return (
    <div className="ap-page">
      <h1 className="ap-title">Welcome back, {firstName}</h1>
      <p className="ap-subtitle">
        {hasMembership ? 'Active member · ' : ''}{upcomingBookings.length} upcoming session{upcomingBookings.length !== 1 ? 's' : ''}
      </p>

      {/* ── Needs attention ─────────────────────────────────────────────── */}
      {waiverExpired && (
        <div className="ap-alert">
          <div className="ap-alert-icon">!</div>
          <div>
            <p className="ap-alert-title">Waiver required</p>
            <p className="ap-alert-body">
              You need a signed waiver on file to book a bay. It only takes a minute.
            </p>
            <a href="/waiver" className="ap-alert-link">Sign waiver →</a>
          </div>
        </div>
      )}

      {/* ── Book a bay CTA ──────────────────────────────────────────────── */}
      {!waiverExpired && (
        <a href="/book" className="ap-btn primary" style={{ display: 'flex', marginBottom: 14, height: 48, fontSize: '0.92rem' }}>
          Book a Bay →
        </a>
      )}

      {/* ── Upcoming bookings ───────────────────────────────────────────── */}
      {upcomingBookings.length > 0 && (
        <div className="ap-card" style={{ marginBottom: 14 }}>
          <p className="ap-card-title">Upcoming Sessions</p>
          {upcomingBookings.map(b => (
            <div key={b.id} className="ap-booking-card" style={{ background: 'none', border: 'none', padding: '10px 0', marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="ap-booking-date-col">
                <span className="ap-booking-month">
                  {formatInTimeZone(b.startsAt, FACILITY_TZ, 'MMM')}
                </span>
                <span className="ap-booking-day">
                  {formatInTimeZone(b.startsAt, FACILITY_TZ, 'd')}
                </span>
              </div>
              <div className="ap-booking-info">
                <p className="ap-booking-bay">{b.bayLabel}</p>
                <p className="ap-booking-time">
                  {formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                  {formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}
                </p>
              </div>
              <a href={`/account/bookings/${b.id}`} className="ap-booking-link">View →</a>
            </div>
          ))}
          <div style={{ paddingTop: 12 }}>
            <a href="/account/bookings" className="ap-btn ghost" style={{ height: 36, fontSize: '0.8rem', padding: '0 14px' }}>
              All bookings
            </a>
          </div>
        </div>
      )}

      {upcomingBookings.length === 0 && (
        <div className="ap-card">
          <p className="ap-card-title">Upcoming Sessions</p>
          <p className="ap-empty">No upcoming sessions. Book a bay to get started.</p>
        </div>
      )}

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div className="ap-quick-grid">
        <a href="/account/bookings" className="ap-quick-link">
          <div className="ap-quick-link-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="ap-quick-link-label">My Bookings</p>
            <p className="ap-quick-link-sub">Past &amp; upcoming</p>
          </div>
        </a>
        <a href="/account/guests" className="ap-quick-link">
          <div className="ap-quick-link-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 14c0-2.76 2.24-5 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </div>
          <div>
            <p className="ap-quick-link-label">Guests &amp; Waivers</p>
            <p className="ap-quick-link-sub">Manage your group</p>
          </div>
        </a>
        <a href="/account/membership-billing" className="ap-quick-link">
          <div className="ap-quick-link-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </div>
          <div>
            <p className="ap-quick-link-label">Membership &amp; Billing</p>
            <p className="ap-quick-link-sub">{hasMembership ? 'Active' : 'Not enrolled'}</p>
          </div>
        </a>
        <a href="/account/settings" className="ap-quick-link">
          <div className="ap-quick-link-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="ap-quick-link-label">Settings</p>
            <p className="ap-quick-link-sub">Profile &amp; notifications</p>
          </div>
        </a>
      </div>
    </div>
  )
}
