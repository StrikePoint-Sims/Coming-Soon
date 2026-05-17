import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bookings, bays, waiverSignings, memberships, membershipTiers } from '@/db/schema'
import { eq, and, gt, gte, lt, desc, inArray } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import { summarizeUsage, findBestSavings } from '@/lib/booking/usage'
import './account.css'

export const metadata: Metadata = {
  title: 'Account — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  return min % 60 === 0 ? `${min / 60} hr` : `${(min / 60).toFixed(1)} hr`
}

function fmtHours(minutes: number): string {
  if (minutes === 0) return '0 hr'
  const h = minutes / 60
  return h % 1 === 0 ? `${h} hr` : `${h.toFixed(1)} hr`
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

export default async function AccountDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60_000)

  const [upcomingBookings, [latestWaiver], [membership], recentBookings, last30Bookings] = await Promise.all([
    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        bayLabel: bays.label,
        status: bookings.status,
        partySize: bookings.partySize,
      })
      .from(bookings)
      .innerJoin(bays, eq(bookings.bayId, bays.id))
      .where(and(
        eq(bookings.userId, user.id),
        gt(bookings.startsAt, now),
        inArray(bookings.status, ['confirmed', 'pending', 'checked_in']),
      ))
      .orderBy(bookings.startsAt)
      .limit(3),

    db
      .select({ expiresAt: waiverSignings.expiresAt })
      .from(waiverSignings)
      .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
      .orderBy(desc(waiverSignings.signedAt))
      .limit(1),

    db
      .select({
        id: memberships.id,
        status: memberships.status,
        currentPeriodEnd: memberships.currentPeriodEnd,
        startedAt: memberships.startedAt,
        tierName: membershipTiers.name,
        includedPeakMinutes: membershipTiers.sessionMinutes,
      })
      .from(memberships)
      .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
      .where(and(
        eq(memberships.userId, user.id),
        gt(memberships.currentPeriodEnd, now),
      ))
      .limit(1),

    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        bayLabel: bays.label,
        status: bookings.status,
        totalCents: bookings.totalCents,
      })
      .from(bookings)
      .innerJoin(bays, eq(bookings.bayId, bays.id))
      .where(eq(bookings.userId, user.id))
      .orderBy(desc(bookings.startsAt))
      .limit(5),

    db
      .select({
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        totalCents: bookings.totalCents,
      })
      .from(bookings)
      .where(and(
        eq(bookings.userId, user.id),
        gte(bookings.startsAt, thirtyDaysAgo),
        lt(bookings.startsAt, now),
        inArray(bookings.status, ['confirmed', 'checked_in', 'completed']),
      )),
  ])

  const waiverExpired = !latestWaiver
  const nextBooking = upcomingBookings[0]
  const isMember = !!membership

  // ── Usage stats (always shown) ────────────────────────────────────────────
  const usage = summarizeUsage(last30Bookings)

  // ── Savings recommendation (non-members only, if applicable) ──────────────
  const savings = !isMember ? findBestSavings(usage) : null
  const SAVINGS_THRESHOLD_CENTS = 2500
  const showSavingsPitch = savings && savings.savingsCents >= SAVINGS_THRESHOLD_CENTS

  return (
    <div className="dash-page">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <h1 className="dash-title">Account Dashboard</h1>
        <p className="dash-subtitle">Manage your bookings, membership, and preferences.</p>
      </div>

      {/* ── Waiver alert ──────────────────────────────────────────────── */}
      {waiverExpired && (
        <a href="/waiver" className="dash-waiver-alert">
          <div className="dash-waiver-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          <div className="dash-waiver-text">
            <p className="dash-waiver-title">Waiver required</p>
            <p className="dash-waiver-body">Sign your annual waiver before booking a bay.</p>
          </div>
          <span className="dash-chevron">›</span>
        </a>
      )}

      {/* ── Top row ───────────────────────────────────────────────────── */}
      <div className="dash-grid-2">

        {isMember ? (
          <MembershipCard
            tierName={membership.tierName}
            startedAt={membership.startedAt}
            currentPeriodEnd={membership.currentPeriodEnd}
            peakMinutesUsed={usage.peakMinutes}
            peakMinutesIncluded={membership.includedPeakMinutes ?? 0}
          />
        ) : (
          <UpcomingBookingCard nextBooking={nextBooking ?? null} />
        )}

        {isMember ? (
          <UpcomingBookingCard nextBooking={nextBooking ?? null} />
        ) : (
          <ActivityCard usage={usage} />
        )}
      </div>

      {/* ── Savings pitch (only when calculated savings exceed threshold) ─ */}
      {showSavingsPitch && savings && (
        <a href="/memberships" className="dash-savings-pitch">
          <div className="dash-savings-icon">
            <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 1l3 6.5L21 9l-5 4.5L17.5 21 11 17l-6.5 4L6 13.5 1 9l7-1.5L11 1z"/>
            </svg>
          </div>
          <div className="dash-savings-text">
            <p className="dash-savings-eyebrow">A QUICK NOTE</p>
            <p className="dash-savings-title">
              Based on your last 30 days, the <strong>{savings.bestTier.name}</strong> membership would have saved you <strong>{fmtMoney(savings.savingsCents)}</strong>.
            </p>
            <p className="dash-savings-body">
              You played {fmtHours(usage.totalMinutes)} across {usage.sessions} session{usage.sessions !== 1 ? 's' : ''} and paid {fmtMoney(usage.paidCents)}. {savings.bestTier.name} is {fmtMoney(savings.bestTierCost)}/mo at your usage.
            </p>
          </div>
          <span className="dash-savings-cta">View Plans ›</span>
        </a>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div className="dash-section-card">
        <div className="dash-section-header">
          <span className="dash-section-label gold">QUICK ACTIONS</span>
        </div>
        <div className="dash-quick-grid">
          <a href="/book" className="dash-quick-card">
            <div className="dash-quick-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="3" y="5" width="16" height="14" rx="2"/>
                <path d="M7 3v4M15 3v4M3 9.5h16"/>
              </svg>
            </div>
            <p className="dash-quick-label">Book a Bay</p>
            <p className="dash-quick-sub">Reserve your next session.</p>
            <span className="dash-quick-chevron">›</span>
          </a>
          <a href="/account/bookings" className="dash-quick-card">
            <div className="dash-quick-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <rect x="2.5" y="4" width="17" height="14" rx="2"/>
                <path d="M2.5 9h17M7 11.5h3M7 14h6"/>
              </svg>
            </div>
            <p className="dash-quick-label">My Bookings</p>
            <p className="dash-quick-sub">View past and upcoming.</p>
            <span className="dash-quick-chevron">›</span>
          </a>
          <a href="/account/guests" className="dash-quick-card">
            <div className="dash-quick-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="8" cy="8" r="3.5"/>
                <path d="M2 19a6 6 0 0112 0"/>
                <circle cx="16" cy="9" r="2.5"/>
                <path d="M14 19a4 4 0 016 0"/>
              </svg>
            </div>
            <p className="dash-quick-label">Guests &amp; Waivers</p>
            <p className="dash-quick-sub">Manage your guest list.</p>
            <span className="dash-quick-chevron">›</span>
          </a>
          <a href="/account/settings" className="dash-quick-card">
            <div className="dash-quick-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="11" cy="11" r="3"/>
                <path d="M11 2v3M11 17v3M2 11h3M17 11h3M4.5 4.5l2 2M15.5 15.5l2 2M4.5 17.5l2-2M15.5 6.5l2-2"/>
              </svg>
            </div>
            <p className="dash-quick-label">Settings</p>
            <p className="dash-quick-sub">Profile and preferences.</p>
            <span className="dash-quick-chevron">›</span>
          </a>
        </div>
      </div>

      {/* ── Bottom row: Recent + Activity-for-members (or just Recent) ── */}
      <div className="dash-grid-2">

        {/* Recent Reservations */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <span className="dash-section-label gold">RECENT RESERVATIONS</span>
            <a href="/account/bookings" className="dash-section-link">View All</a>
          </div>

          {recentBookings.length === 0 ? (
            <p className="dash-empty-line">No reservations yet.</p>
          ) : (
            <div className="dash-recent-list">
              {recentBookings.map(b => (
                <a key={b.id} href={`/account/bookings/${b.id}`} className="dash-recent-row">
                  <div className="dash-recent-info">
                    <p className="dash-recent-date">
                      {formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEE, MMM d, yyyy')}
                    </p>
                    <p className="dash-recent-time">
                      {formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                      {formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}
                      {' · '}{b.bayLabel}
                    </p>
                  </div>
                  <div className="dash-recent-meta">
                    {b.totalCents > 0 && (
                      <span className="dash-recent-price">${(b.totalCents / 100).toFixed(2)}</span>
                    )}
                    <span className={`dash-status ${badgeClass(b.status)}`}>
                      {statusLabel(b.status)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* For members: their booking is in the top row, so put Activity here.
            For non-members: their activity is already in the top row, so put
            something more useful: an activity-over-time summary or a quiet
            "Explore Memberships" tile. */}
        {isMember ? (
          <ActivityCard usage={usage} compact />
        ) : (
          <ExploreMembershipsCard hasUsage={usage.sessions > 0} />
        )}
      </div>
    </div>
  )
}

// ── Components ──────────────────────────────────────────────────────────────

function MembershipCard({
  tierName,
  startedAt,
  currentPeriodEnd,
  peakMinutesUsed,
  peakMinutesIncluded,
}: {
  tierName: string
  startedAt: Date
  currentPeriodEnd: Date
  peakMinutesUsed: number
  peakMinutesIncluded: number
}) {
  const peakHoursUsed = Math.round(peakMinutesUsed / 60)
  const peakHoursIncluded = Math.round(peakMinutesIncluded / 60)
  const peakHoursRemaining = Math.max(0, peakHoursIncluded - peakHoursUsed)

  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">MEMBERSHIP</span>
        <span className="dash-pill active">Active</span>
      </div>
      <div className="dash-member-hero">
        <div className="dash-member-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18l3-12 4 8 2-6 2 6 4-8 3 12z"/>
            <path d="M3 21h18"/>
          </svg>
        </div>
        <div>
          <p className="dash-member-tier">{tierName} Member</p>
          <p className="dash-member-since">
            Member since {formatInTimeZone(startedAt, FACILITY_TZ, 'MMM d, yyyy')}
          </p>
        </div>
      </div>

      {peakHoursIncluded > 0 ? (
        <div className="dash-peak-tracker">
          <div className="dash-peak-row">
            <span className="dash-peak-label">Peak Hours Used</span>
            <span className="dash-peak-value">
              {peakHoursUsed} / {peakHoursIncluded}
            </span>
          </div>
          <div className="dash-peak-bar">
            <div
              className="dash-peak-bar-fill"
              style={{ width: `${peakHoursIncluded === 0 ? 0 : Math.min(100, (peakHoursUsed / peakHoursIncluded) * 100)}%` }}
            />
          </div>
          <p className="dash-peak-sub">
            {peakHoursRemaining} hour{peakHoursRemaining !== 1 ? 's' : ''} remaining ·
            Resets {formatInTimeZone(currentPeriodEnd, FACILITY_TZ, 'MMM d')}
          </p>
        </div>
      ) : (
        <p className="dash-peak-sub" style={{ marginTop: 4 }}>
          Unlimited off-peak access. Renews {formatInTimeZone(currentPeriodEnd, FACILITY_TZ, 'MMM d, yyyy')}.
        </p>
      )}

      <a href="/account/membership-billing" className="dash-btn ghost dash-btn-full">
        Manage Membership
      </a>
    </div>
  )
}

function UpcomingBookingCard({
  nextBooking,
}: {
  nextBooking: null | {
    id: string
    startsAt: Date
    endsAt: Date
    bayLabel: string
    status: string
    partySize: number
  }
}) {
  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">UPCOMING BOOKING</span>
        <a href="/account/bookings" className="dash-section-link">View All</a>
      </div>

      {nextBooking ? (
        <>
          <div className="dash-upcoming-row">
            <div className="dash-date-badge">
              <span className="dash-date-month">
                {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'MMM').toUpperCase()}
              </span>
              <span className="dash-date-day">
                {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'd')}
              </span>
            </div>
            <div className="dash-upcoming-detail">
              <p className="dash-upcoming-date">
                {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'EEE, MMM d, yyyy')}
              </p>
              <p className="dash-upcoming-time">
                {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'h:mm a')} –{' '}
                {formatInTimeZone(nextBooking.endsAt, FACILITY_TZ, 'h:mm a')}
                {' '}<span className="dash-muted">({durationLabel(nextBooking.startsAt, nextBooking.endsAt)})</span>
              </p>
              <p className="dash-upcoming-meta">
                {nextBooking.bayLabel}
                {nextBooking.partySize > 0 ? ` · ${nextBooking.partySize} Player${nextBooking.partySize !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
          <a href={`/account/bookings/${nextBooking.id}`} className="dash-btn primary dash-btn-full">
            Manage Booking
          </a>
          <a href="/book" className="dash-btn ghost dash-btn-full">
            Book Another Bay
          </a>
        </>
      ) : (
        <div className="dash-empty-block">
          <p className="dash-empty-heading">No upcoming sessions</p>
          <p className="dash-empty-body">Reserve your bay and get back in the game.</p>
          <a href="/book" className="dash-btn primary dash-btn-full">
            Book a Bay
          </a>
        </div>
      )}
    </div>
  )
}

function ActivityCard({
  usage,
  compact = false,
}: {
  usage: ReturnType<typeof summarizeUsage>
  compact?: boolean
}) {
  return (
    <div className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">LAST 30 DAYS</span>
      </div>

      {usage.sessions === 0 ? (
        <p className="dash-empty-line">
          {compact ? 'No sessions yet this month.' : 'No sessions yet in the last 30 days.'}
        </p>
      ) : (
        <>
          <div className="dash-activity-stats">
            <div className="dash-activity-stat">
              <p className="dash-activity-value">{usage.sessions}</p>
              <p className="dash-activity-label">Session{usage.sessions !== 1 ? 's' : ''}</p>
            </div>
            <div className="dash-activity-stat">
              <p className="dash-activity-value">{fmtHours(usage.totalMinutes)}</p>
              <p className="dash-activity-label">Played</p>
            </div>
            <div className="dash-activity-stat">
              <p className="dash-activity-value">{fmtMoney(usage.paidCents)}</p>
              <p className="dash-activity-label">{compact ? 'Spent' : 'Spent on Bay Time'}</p>
            </div>
          </div>

          {!compact && (
            <div className="dash-activity-breakdown">
              <span className="dash-activity-chip">
                <span className="dash-chip-dot peak" />
                {fmtHours(usage.peakMinutes)} peak
              </span>
              <span className="dash-activity-chip">
                <span className="dash-chip-dot offpeak" />
                {fmtHours(usage.offPeakMinutes)} off-peak
              </span>
              {usage.nightMinutes > 0 && (
                <span className="dash-activity-chip">
                  <span className="dash-chip-dot night" />
                  {fmtHours(usage.nightMinutes)} night
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExploreMembershipsCard({ hasUsage }: { hasUsage: boolean }) {
  return (
    <div className="dash-section-card dash-explore">
      <div className="dash-section-header">
        <span className="dash-section-label gold">MEMBERSHIPS</span>
      </div>
      <p className="dash-explore-body">
        {hasUsage
          ? 'See if a membership fits how you actually play.'
          : 'Members get unlimited off-peak access plus included peak hours.'}
      </p>
      <a href="/memberships" className="dash-btn ghost dash-btn-full" style={{ marginTop: 12 }}>
        Explore Plans
      </a>
    </div>
  )
}

function statusLabel(status: string): string {
  if (status === 'checked_in') return 'Checked In'
  if (status === 'no_show') return 'No Show'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function badgeClass(status: string): string {
  if (status === 'confirmed' || status === 'checked_in') return 'confirmed'
  if (status === 'pending') return 'pending'
  if (status === 'completed') return 'completed'
  return 'cancelled'
}
