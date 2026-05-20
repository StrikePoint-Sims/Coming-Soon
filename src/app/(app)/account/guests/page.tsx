import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import { bookingGuests, bookings, waiverSignings } from '@/db/schema'
import { and, desc, eq, gt } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { addAccountGuest, sendAllGuestWaiverLinks, sendGuestWaiverLinkAction } from './actions'
import '../account.css'

export const metadata: Metadata = {
  title: 'Guests & Waivers - StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

type GuestStatus = 'signed' | 'pending' | 'expired'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return (first + (parts.length > 1 ? last : '')).toUpperCase()
}

function statusFor(expiresAt?: Date | null): GuestStatus {
  if (!expiresAt) return 'pending'
  return expiresAt > new Date() ? 'signed' : 'expired'
}

function durationLabel(startsAt: Date, endsAt: Date): string {
  const min = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
  return min % 60 === 0 ? `${min / 60} hr` : `${(min / 60).toFixed(1)} hr`
}

function messageFor(searchParams: { added?: string; sent?: string; error?: string }) {
  if (searchParams.added) return { type: 'success', text: 'Guest added and waiver link sent.' }
  if (searchParams.sent) return { type: 'success', text: `${searchParams.sent} waiver link${searchParams.sent === '1' ? '' : 's'} sent.` }
  if (searchParams.error === 'capacity') return { type: 'error', text: 'That booking already has 3 guests.' }
  if (searchParams.error === 'booking') return { type: 'error', text: 'Choose an upcoming booking before adding a guest.' }
  if (searchParams.error) return { type: 'error', text: 'Please add a guest name and at least one contact method.' }
  return null
}

export default async function GuestsWaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; sent?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()
  const params = await searchParams

  const [guestRows, upcomingBookings] = await Promise.all([
    db
      .select({
        id: bookingGuests.id,
        bookingId: bookingGuests.bookingId,
        name: bookingGuests.name,
        email: bookingGuests.email,
        phone: bookingGuests.phone,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        waiverExpiresAt: waiverSignings.expiresAt,
      })
      .from(bookingGuests)
      .innerJoin(bookings, eq(bookingGuests.bookingId, bookings.id))
      .leftJoin(waiverSignings, eq(bookingGuests.waiverSigningId, waiverSignings.id))
      .where(eq(bookings.userId, user.id))
      .orderBy(desc(bookings.startsAt)),

    db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), gt(bookings.startsAt, now)))
      .orderBy(bookings.startsAt),
  ])

  const message = messageFor(params)
  const canSendAny = guestRows.some(g => statusFor(g.waiverExpiresAt) !== 'signed' && (g.email || g.phone))

  return (
    <div className="dash-page dash-page-v2 dash-subpage">
      <div className="dash-header">
        <h1 className="dash-title">Guests &amp; Waivers</h1>
        <p className="dash-subtitle">
          Add and manage guests for your bookings. Waivers are required annually for all visitors.
        </p>
      </div>

      <div className="gw-layout">
        <div className="gw-main">
          {message && (
            <div className={`gw-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="gw-banner">
            <div className="gw-banner-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 21s7-3.5 7-9V4.5L11 2 4 4.5V11c0 5.5 7 9 7 9z"/>
                <path d="M8 11l2.5 2.5L15 9"/>
              </svg>
            </div>
            <div>
              <p className="gw-banner-title">Waivers are handled automatically.</p>
              <p className="gw-banner-body">Add a guest by name and phone or email. We check their waiver status and send a personal signing link when needed.</p>
            </div>
          </div>

          <div className="dash-section-card gw-add-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">ADD A GUEST</span>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="dash-empty-block compact">
                <p className="dash-empty-heading">No upcoming bookings</p>
                <p className="dash-empty-body">Book a bay first, then add guests to that reservation.</p>
                <a href="/book" className="dash-btn primary dash-btn-full">Book a Bay</a>
              </div>
            ) : (
              <form action={addAccountGuest} className="gw-add-form" autoComplete="off">
                <label className="gw-field">
                  <span>Booking</span>
                  <select name="bookingId" className="gw-input" required>
                    {upcomingBookings.map(booking => (
                      <option key={booking.id} value={booking.id}>
                        {formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE, MMM d, h:mm a')} - {durationLabel(booking.startsAt, booking.endsAt)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gw-field">
                  <span>Name</span>
                  <input name="name" className="gw-input" placeholder="Guest name" autoComplete="off" required />
                </label>
                <label className="gw-field">
                  <span>Phone</span>
                  <input name="phone" className="gw-input" type="tel" placeholder="(203) 555-0100" autoComplete="off" />
                </label>
                <label className="gw-field">
                  <span>Email optional</span>
                  <input name="email" className="gw-input" type="email" placeholder="guest@example.com" autoComplete="off" />
                </label>
                <button type="submit" className="dash-btn primary gw-add-submit">Add Guest</button>
              </form>
            )}
          </div>

          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">YOUR GUESTS</span>
              <div className="gw-header-actions">
                <form action={sendAllGuestWaiverLinks}>
                  <button type="submit" className="dash-btn ghost gw-btn-sm" disabled={!canSendAny}>Send Waiver Link to All</button>
                </form>
              </div>
            </div>

            {guestRows.length === 0 ? (
              <div className="dash-empty-block">
                <p className="dash-empty-heading">No guests added yet</p>
                <p className="dash-empty-body">
                  Add a guest to an upcoming booking and we&apos;ll send their waiver link.
                </p>
              </div>
            ) : (
              <div className="gw-list">
                {guestRows.map(g => {
                  const status = statusFor(g.waiverExpiresAt)
                  return (
                    <div key={g.id} className="gw-row">
                      <div className="gw-avatar">{initials(g.name ?? 'Guest')}</div>
                      <div className="gw-info">
                        <p className="gw-name">{g.name ?? 'Guest'}</p>
                        <p className="gw-email">
                          {[g.email, g.phone].filter(Boolean).join(' - ') || 'No contact on file'}
                        </p>
                        <p className="gw-booking-line">
                          {formatInTimeZone(g.startsAt, FACILITY_TZ, 'EEE, MMM d, h:mm a')} - {durationLabel(g.startsAt, g.endsAt)}
                        </p>
                      </div>
                      <div className="gw-status-col">
                        <span className={`gw-status ${status}`}>
                          <span className="gw-status-dot" />
                          {status === 'signed' ? 'Signed' : status === 'pending' ? 'Pending' : 'Expired'}
                        </span>
                        <span className="gw-status-date">
                          {status === 'signed' && g.waiverExpiresAt
                            ? `Valid until ${formatInTimeZone(g.waiverExpiresAt, FACILITY_TZ, 'MMM d, yyyy')}`
                            : 'Waiver needed'}
                        </span>
                      </div>
                      {status !== 'signed' && (g.email || g.phone) && (
                        <form action={sendGuestWaiverLinkAction}>
                          <input type="hidden" name="guestId" value={g.id} />
                          <button type="submit" className="gw-row-action-text">Send link</button>
                        </form>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <p className="gw-footer-note">
            You can add guests anytime, including at booking. We&apos;ll check if their waiver is on file and text or email a link if it&apos;s missing or expired. Waivers are valid for one year from the date signed.
          </p>
        </div>

        <aside className="gw-aside">
          <div className="dash-section-card gw-policy">
            <div className="gw-policy-icon">
              <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="9" cy="9" r="3.5"/>
                <path d="M2 22a7 7 0 0114 0"/>
                <circle cx="20" cy="10" r="2.8"/>
                <path d="M16 22a5 5 0 0110 0"/>
              </svg>
            </div>
            <p className="gw-policy-title">GUEST POLICY</p>
            <p className="gw-policy-tagline">Each booking includes</p>
            <p className="gw-policy-headline">Up to 3 Guests</p>
            <p className="gw-policy-sub">Member or booking holder plus guests</p>

            <div className="gw-policy-divider" />

            <ul className="gw-policy-list">
              <li><span className="gw-policy-bullet">&#10003;</span> Members can bring up to 3 guests per booking.</li>
              <li><span className="gw-policy-bullet">&#10003;</span> Add a guest anytime with name and contact info.</li>
              <li><span className="gw-policy-bullet">&#10003;</span> We send signing links when a waiver is missing.</li>
              <li><span className="gw-policy-bullet">&#10003;</span> Waivers are valid for one year from the date signed.</li>
            </ul>

            <a href="/memberships" className="dash-btn ghost dash-btn-full" style={{ marginTop: 16 }}>
              Learn More
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
