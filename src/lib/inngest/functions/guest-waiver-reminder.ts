import { inngest } from '@/lib/inngest/client'
import { db } from '@/db'
import { bookingGuests, waiverSignings, bookings, users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { sendGuestWaiverLink } from '@/lib/waivers/guest-links'

export const guestWaiverReminder = inngest.createFunction(
  { id: 'guest-waiver-reminder', name: 'Send 24h waiver reminder to unsigned guests' },
  { event: 'waiver/guest-reminder' },
  async ({ event }) => {
    const { guestId, bookingId } = event.data as { guestId?: string; bookingId: string; tokenHash?: string }

    // Look up the specific guest. Prefer the explicit guestId from the event;
    // fall back to bookingId only when the event doesn't include one. (Previously
    // we always matched bookingId, which is wrong for bookings with multiple guests.)
    const guestWhere = guestId
      ? eq(bookingGuests.id, guestId)
      : eq(bookingGuests.bookingId, bookingId)

    const [guest] = await db.select().from(bookingGuests).where(guestWhere).limit(1)
    if (!guest) return { skipped: true, reason: 'guest not found' }

    // Skip if this guest already has a valid signing on file.
    if (guest.waiverSigningId) {
      const [signed] = await db
        .select({ id: waiverSignings.id })
        .from(waiverSignings)
        .where(
          and(
            eq(waiverSignings.id, guest.waiverSigningId),
            gt(waiverSignings.expiresAt, new Date()),
          ),
        )
        .limit(1)
      if (signed) return { skipped: true, reason: 'waiver already signed' }
    }

    const [booking] = await db
      .select({ startsAt: bookings.startsAt, userId: bookings.userId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    const [booker] = booking
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, booking.userId)).limit(1)
      : []

    const sessionLabel = booking?.startsAt
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(booking.startsAt)
      : 'your upcoming session'

    // Re-issue a fresh access token and send via the escaped template helper.
    const result = await sendGuestWaiverLink({
      guestId: guest.id,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      hostName: booker?.name ?? 'Your host',
      sessionLabel,
    })

    return { sent: true, email: result.email, sms: result.sms }
  },
)
