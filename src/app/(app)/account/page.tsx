import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { bays, bookings, membershipHourLedger, memberships, membershipTiers, waiverSignings } from '@/db/schema'
import { and, desc, eq, gt, gte, inArray, lt } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import { findBestSavings, summarizeUsage } from '@/lib/booking/usage'
import './account.css'

export const metadata: Metadata = {
  title: 'Account - StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'
const SAVINGS_THRESHOLD_CENTS = 2500

type UsageSummary = ReturnType<typeof summarizeUsage>

type MembershipHourRow = {
  bookingId: string | null
  kind: string
  minutes: number
  bookingStartsAt: Date | null
  bookingStatus: string | null
}

type BookingSummary = {
  id: string
  startsAt: Date
  endsAt: Date
  bayLabel: string | null
  status: string
  totalCents?: number
  partySize?: number
}

function summarizeMembershipHours(rows: MembershipHourRow[], now: Date) {
  const byBooking = new Map<string, { minutes: number; startsAt: Date | null; status: string | null }>()
  let unbookedMinutes = 0

  for (const row of rows) {
    const signedMinutes = row.kind === 'refund' ? -row.minutes : row.minutes
    if (!row.bookingId) {
      unbookedMinutes += signedMinutes
      continue
    }

    const existing = byBooking.get(row.bookingId) ?? {
      minutes: 0,
      startsAt: row.bookingStartsAt,
      status: row.bookingStatus,
    }
    existing.minutes += signedMinutes
    existing.startsAt = existing.startsAt ?? row.bookingStartsAt
    existing.status = existing.status ?? row.bookingStatus
    byBooking.set(row.bookingId, existing)
  }

  let usedMinutes = Math.max(0, unbookedMinutes)
  let reservedMinutes = 0
  for (const entry of byBooking.values()) {
    const minutes = Math.max(0, entry.minutes)
    if (minutes === 0) continue
    const isUpcomingActive =
      entry.startsAt &&
      entry.startsAt > now &&
      entry.status !== 'cancelled' &&
      entry.status !== 'no_show'

    if (isUpcomingActive) reservedMinutes += minutes
    else usedMinutes += minutes
  }

  return { usedMinutes, reservedMinutes }
}

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

function firstName(user: { name?: string | null; email?: string | null }) {
  return user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there'
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
      .leftJoin(bays, eq(bookings.bayId, bays.id))
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
        inArray(memberships.status, ['active', 'reactivated', 'trial']),
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
      .leftJoin(bays, eq(bookings.bayId, bays.id))
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

  const usage = summarizeUsage(last30Bookings)
  const membershipHourRows = membership
    ? await db
      .select({
        bookingId: membershipHourLedger.bookingId,
        kind: membershipHourLedger.kind,
        minutes: membershipHourLedger.minutes,
        bookingStartsAt: bookings.startsAt,
        bookingStatus: bookings.status,
      })
      .from(membershipHourLedger)
      .leftJoin(bookings, eq(membershipHourLedger.bookingId, bookings.id))
      .where(and(
        eq(membershipHourLedger.membershipId, membership.id),
        gte(membershipHourLedger.createdAt, membership.startedAt),
        lt(membershipHourLedger.createdAt, membership.currentPeriodEnd),
      ))
    : []
  const membershipHourSummary = summarizeMembershipHours(membershipHourRows, now)
  const nextBooking = upcomingBookings[0] ?? null
  const isMember = !!membership
  const savings = !isMember ? findBestSavings(usage) : null
  const showSavingsPitch = savings && savings.savingsCents >= SAVINGS_THRESHOLD_CENTS

  return (
    <div className="dash-page dash-page-v2">
      <header className="dash-greeting">
        <p className="dash-greeting-date">{formatInTimeZone(now, FACILITY_TZ, 'EEEE, MMMM d')}</p>
        <h1>Good {greetingFor(now)}, {firstName(user)}.</h1>
      </header>

      {!latestWaiver && (
        <a href="/waiver" className="dash-waiver-alert">
          <div className="dash-waiver-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          <div className="dash-waiver-text">
            <p className="dash-waiver-title">Waiver required</p>
            <p className="dash-waiver-body">Every visitor needs a waiver on file before using the facility.</p>
          </div>
          <span className="dash-chevron">›</span>
        </a>
      )}

      <SessionTicker nextBooking={nextBooking} now={now} />
      <NextSessionCard nextBooking={nextBooking} now={now} />
      <QuickRebook recentBookings={recentBookings} />

      <div className="dash-grid-2 dash-main-grid">
        {isMember ? (
          <MembershipCard
            tierName={membership.tierName}
            startedAt={membership.startedAt}
            currentPeriodEnd={membership.currentPeriodEnd}
            usedMinutes={membershipHourSummary.usedMinutes}
            reservedMinutes={membershipHourSummary.reservedMinutes}
            includedMinutes={membership.includedPeakMinutes ?? 0}
          />
        ) : (
          <ExploreMembershipsCard hasUsage={usage.sessions > 0} />
        )}
        <ActivityCard usage={usage} />
      </div>

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
              You played {fmtHours(usage.totalMinutes)} across {usage.sessions} session{usage.sessions !== 1 ? 's' : ''} and paid {fmtMoney(usage.paidCents)}.
            </p>
          </div>
          <span className="dash-savings-cta">View Plans ›</span>
        </a>
      )}

      <QuickActions />
      <RecentReservations bookings={recentBookings} />
    </div>
  )
}

function greetingFor(now: Date): string {
  const hour = Number(formatInTimeZone(now, FACILITY_TZ, 'H'))
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function SessionTicker({ nextBooking, now }: { nextBooking: BookingSummary | null; now: Date }) {
  if (!nextBooking) return null
  const minutesUntil = Math.round((nextBooking.startsAt.getTime() - now.getTime()) / 60_000)
  if (minutesUntil < 0 || minutesUntil > 60) return null
  const unlockTime = new Date(nextBooking.startsAt.getTime() - 60 * 60_000)

  return (
    <a href={`/account/bookings/${nextBooking.id}`} className="dash-session-ticker">
      <span className="dash-session-dot" />
      <span className="dash-session-text">
        Your bay opens in <strong>{minutesUntil} minute{minutesUntil !== 1 ? 's' : ''}</strong>. Access details unlock at {formatInTimeZone(unlockTime, FACILITY_TZ, 'h:mm a')}.
      </span>
      <span className="dash-session-cta">View ›</span>
    </a>
  )
}

function NextSessionCard({ nextBooking, now }: { nextBooking: BookingSummary | null; now: Date }) {
  if (!nextBooking) {
    return (
      <section className="dash-next-card is-empty">
        <div>
          <span className="dash-section-label gold">NEXT SESSION</span>
          <h2>No upcoming sessions.</h2>
          <p>Reserve your next bay and keep the swing loose.</p>
        </div>
        <a href="/book" className="dash-btn primary">Book a Bay</a>
      </section>
    )
  }

  const unlockTime = new Date(nextBooking.startsAt.getTime() - 60 * 60_000)

  return (
    <section className="dash-next-card">
      <div className="dash-next-top">
        <div className="dash-next-left">
          <div className="dash-date-badge">
            <span className="dash-date-month">{formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'EEE').toUpperCase()}</span>
            <span className="dash-date-day">{formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'd')}</span>
          </div>
          <div>
            <span className="dash-section-label gold">NEXT SESSION</span>
            <h2>
              {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'h:mm a')} - {formatInTimeZone(nextBooking.endsAt, FACILITY_TZ, 'h:mm a')}
              {nextBooking.startsAt.getTime() - now.getTime() <= 60 * 60_000 && nextBooking.bayLabel ? ` · ${nextBooking.bayLabel}` : ''}
            </h2>
            <p>
              {formatInTimeZone(nextBooking.startsAt, FACILITY_TZ, 'MMMM d, yyyy')} · {durationLabel(nextBooking.startsAt, nextBooking.endsAt)}
              {nextBooking.partySize ? ` · ${nextBooking.partySize} player${nextBooking.partySize !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
        </div>
        <span className={`dash-status ${badgeClass(nextBooking.status)}`}>{statusLabel(nextBooking.status)}</span>
      </div>

      <div className="dash-access-panel">
        <div className="dash-access-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 018 0v4"/>
          </svg>
        </div>
        <div>
          <p className="dash-access-label">Access details</p>
          <p className="dash-access-copy">Your one-time access code is sent via text message 1 hour before your session, around <strong>{formatInTimeZone(unlockTime, FACILITY_TZ, 'h:mm a')}</strong>.</p>
        </div>
      </div>

      <div className="dash-next-actions">
        <a href={`/api/book/${nextBooking.id}/ics`} className="dash-btn ghost">Add to Calendar</a>
        <a href={`/book/${nextBooking.id}/guests`} className="dash-btn ghost">Add Guests</a>
        <a href="/book" className="dash-btn ghost">Book Again</a>
        <a href={`/account/bookings/${nextBooking.id}`} className="dash-btn primary">View Details</a>
      </div>
    </section>
  )
}

function QuickRebook({ recentBookings }: { recentBookings: BookingSummary[] }) {
  const suggestions = recentBookings.slice(0, 2)
  if (suggestions.length === 0) return null

  return (
    <section className="dash-regular">
      <div className="dash-section-header slim">
        <span className="dash-section-label gold">SECURE YOUR REGULAR SLOTS</span>
        <a href="/book" className="dash-section-link">Open calendar ›</a>
      </div>
      <div className="dash-regular-grid">
        {suggestions.map((booking, index) => (
          <a href="/book" className="dash-regular-card" key={`${booking.id}-${index}`}>
            <span className="dash-regular-kicker">{index === 0 ? 'Same rhythm' : 'Recent favorite'}</span>
            <span className="dash-regular-title">
              {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE')} · {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'h:mm a')} - {formatInTimeZone(booking.endsAt, FACILITY_TZ, 'h:mm a')}
            </span>
            <span className="dash-regular-sub">{booking.bayLabel ? `${booking.bayLabel} · ` : ''}{durationLabel(booking.startsAt, booking.endsAt)}</span>
            <span className="dash-regular-arrow">›</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function MembershipCard({
  tierName,
  startedAt,
  currentPeriodEnd,
  usedMinutes,
  reservedMinutes,
  includedMinutes,
}: {
  tierName: string
  startedAt: Date
  currentPeriodEnd: Date
  usedMinutes: number
  reservedMinutes: number
  includedMinutes: number
}) {
  const usedHours = usedMinutes / 60
  const reservedHours = reservedMinutes / 60
  const includedHours = includedMinutes / 60
  const availableHours = Math.max(0, includedHours - usedHours - reservedHours)
  const committedHours = Math.min(includedHours, usedHours + reservedHours)
  const committedPct = includedHours > 0 ? Math.min(100, (committedHours / includedHours) * 100) : 0
  const stat = (value: number) => Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  const peakHoursRemaining = availableHours

  return (
    <section className="dash-section-card dash-member-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">MEMBERSHIP</span>
        <a href="/account/membership-billing" className="dash-section-link">Manage ›</a>
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
          <p className="dash-member-since">Member since {formatInTimeZone(startedAt, FACILITY_TZ, 'MMM d, yyyy')}</p>
        </div>
      </div>

      {includedHours > 0 ? (
        <div className="dash-peak-tracker">
          <div className="dash-peak-row">
            <span className="dash-peak-label">Membership hours this period</span>
            <span className="dash-peak-value">{stat(committedHours)} <span>of {stat(includedHours)}</span></span>
          </div>
          <div className="dash-peak-bar">
            <div className="dash-peak-bar-fill" style={{ width: `${committedPct}%` }} />
          </div>
          <div className="dash-hour-stats" aria-label="Membership hour balance">
            <div className="dash-hour-stat used">
              <span className="dash-hour-stat-value">{stat(usedHours)}</span>
              <span className="dash-hour-stat-label">Used</span>
            </div>
            <div className="dash-hour-stat reserved">
              <span className="dash-hour-stat-value">{stat(reservedHours)}</span>
              <span className="dash-hour-stat-label">Reserved</span>
            </div>
            <div className="dash-hour-stat available">
              <span className="dash-hour-stat-value">{stat(availableHours)}</span>
              <span className="dash-hour-stat-label">Available</span>
            </div>
          </div>
          <p className="dash-peak-sub">{peakHoursRemaining} hour{peakHoursRemaining !== 1 ? 's' : ''} remaining · Renews {formatInTimeZone(currentPeriodEnd, FACILITY_TZ, 'MMM d')}</p>
        </div>
      ) : (
        <p className="dash-peak-sub">Unlimited off-peak access. Renews {formatInTimeZone(currentPeriodEnd, FACILITY_TZ, 'MMM d, yyyy')}.</p>
      )}
    </section>
  )
}

function ActivityCard({ usage }: { usage: UsageSummary }) {
  const total = Math.max(usage.totalMinutes, 1)
  const peakPct = (usage.peakMinutes / total) * 100
  const offPct = (usage.offPeakMinutes / total) * 100
  const nightPct = (usage.nightMinutes / total) * 100

  return (
    <section className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">LAST 30 DAYS</span>
      </div>
      {usage.sessions === 0 ? (
        <p className="dash-empty-line">No sessions yet in the last 30 days.</p>
      ) : (
        <>
          <div className="dash-activity-stats">
            <div className="dash-activity-stat"><p className="dash-activity-value">{usage.sessions}</p><p className="dash-activity-label">Sessions</p></div>
            <div className="dash-activity-stat"><p className="dash-activity-value">{fmtHours(usage.totalMinutes)}</p><p className="dash-activity-label">Played</p></div>
            <div className="dash-activity-stat"><p className="dash-activity-value">{fmtMoney(usage.paidCents)}</p><p className="dash-activity-label">Spent</p></div>
          </div>
          <div className="dash-split-bar" aria-hidden="true">
            <span className="peak" style={{ width: `${peakPct}%` }} />
            <span className="offpeak" style={{ width: `${offPct}%` }} />
            <span className="night" style={{ width: `${nightPct}%` }} />
          </div>
          <div className="dash-activity-breakdown">
            <span className="dash-activity-chip"><span className="dash-chip-dot peak" />{fmtHours(usage.peakMinutes)} peak</span>
            <span className="dash-activity-chip"><span className="dash-chip-dot offpeak" />{fmtHours(usage.offPeakMinutes)} off-peak</span>
            {usage.nightMinutes > 0 && <span className="dash-activity-chip"><span className="dash-chip-dot night" />{fmtHours(usage.nightMinutes)} night</span>}
          </div>
        </>
      )}
    </section>
  )
}

function QuickActions() {
  const actions = [
    ['Book a bay', 'Reserve your next session', '/book', 'calendar'],
    ['My bookings', 'Past and upcoming', '/account/bookings', 'bookings'],
    ['Guests and waivers', 'Manage your guest list', '/account/guests', 'guests'],
    ['Settings', 'Profile and preferences', '/account/settings', 'settings'],
  ] as const

  return (
    <section className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">QUICK ACTIONS</span>
      </div>
      <div className="dash-quick-grid">
        {actions.map(([label, sub, href, icon]) => (
          <a href={href} className="dash-quick-card" key={label}>
            <div className="dash-quick-icon"><ActionIcon name={icon} /></div>
            <p className="dash-quick-label">{label}</p>
            <p className="dash-quick-sub">{sub}</p>
            <span className="dash-quick-chevron">›</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function ActionIcon({ name }: { name: 'calendar' | 'bookings' | 'guests' | 'settings' }) {
  if (name === 'guests') {
    return <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="3.5"/><path d="M2 19a6 6 0 0112 0"/><circle cx="16" cy="9" r="2.5"/><path d="M14 19a4 4 0 016 0"/></svg>
  }
  if (name === 'bookings') {
    return <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2.5" y="4" width="17" height="14" rx="2"/><path d="M2.5 9h17M7 11.5h3M7 14h6"/></svg>
  }
  if (name === 'settings') {
    return <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="11" cy="11" r="3"/><path d="M11 2v3M11 17v3M2 11h3M17 11h3M4.5 4.5l2 2M15.5 15.5l2 2M4.5 17.5l2-2M15.5 6.5l2-2"/></svg>
  }
  return <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="5" width="16" height="14" rx="2"/><path d="M7 3v4M15 3v4M3 9.5h16"/></svg>
}

function RecentReservations({ bookings }: { bookings: BookingSummary[] }) {
  return (
    <section className="dash-section-card">
      <div className="dash-section-header">
        <span className="dash-section-label gold">RECENT RESERVATIONS</span>
        <a href="/account/bookings" className="dash-section-link">View All ›</a>
      </div>
      {bookings.length === 0 ? (
        <p className="dash-empty-line">No reservations yet.</p>
      ) : (
        <div className="dash-recent-list">
          {bookings.map(b => (
            <a key={b.id} href={`/account/bookings/${b.id}`} className="dash-recent-row">
              <div className="dash-recent-badge">
                <span>{formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEE').toUpperCase()}</span>
                <strong>{formatInTimeZone(b.startsAt, FACILITY_TZ, 'd')}</strong>
              </div>
              <div className="dash-recent-info">
                <p className="dash-recent-date">{formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} - {formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}</p>
                <p className="dash-recent-time">{b.bayLabel ? `${b.bayLabel} · ` : ''}{durationLabel(b.startsAt, b.endsAt)}</p>
              </div>
              <div className="dash-recent-meta">
                {(b.totalCents ?? 0) > 0 && <span className="dash-recent-price">${((b.totalCents ?? 0) / 100).toFixed(2)}</span>}
                <span className={`dash-status ${badgeClass(b.status)}`}>{statusLabel(b.status)}</span>
              </div>
              <span className="dash-recent-chevron">›</span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function ExploreMembershipsCard({ hasUsage }: { hasUsage: boolean }) {
  return (
    <section className="dash-section-card dash-explore">
      <div className="dash-section-header">
        <span className="dash-section-label gold">MEMBERSHIPS</span>
      </div>
      <p className="dash-explore-body">
        {hasUsage
          ? 'See if a membership fits how you actually play.'
          : 'Members get unlimited off-peak access plus included peak hours.'}
      </p>
      <a href="/memberships" className="dash-btn ghost dash-btn-full">Explore Plans</a>
    </section>
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
