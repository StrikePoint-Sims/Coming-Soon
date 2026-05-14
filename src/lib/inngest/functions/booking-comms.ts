import { inngest } from '@/lib/inngest/client'
import { db } from '@/db'
import { bookings, bays, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendUserEmail, sendUserSms } from '@/lib/comms'
import { bookingConfirmationEmail, bookingConfirmationSms, bookingReminderSms } from '@/lib/comms/templates'

// Fires immediately after booking/created — sends confirmation email + SMS
export const bookingConfirmation = inngest.createFunction(
  { id: 'booking-confirmation', retries: 3 },
  { event: 'booking/created' },
  async ({ event }) => {
    const { bookingId, userId } = event.data

    const [booking] = await db
      .select({
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        bayId: bookings.bayId,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) return { skipped: true, reason: 'booking not found' }

    const [bay] = await db
      .select({ label: bays.label })
      .from(bays)
      .where(eq(bays.id, booking.bayId))
      .limit(1)

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const startsAt = booking.startsAt.toISOString()
    const endsAt = booking.endsAt.toISOString()
    const bayLabel = bay?.label ?? 'your bay'
    const firstName = user?.name?.split(' ')[0] ?? 'there'

    const emailTemplate = bookingConfirmationEmail({ firstName, bookingId, bayLabel, startsAt, endsAt })

    await Promise.all([
      sendUserEmail({ userId, ...emailTemplate, tags: ['booking-confirmation'] }),
      sendUserSms({
        userId,
        content: bookingConfirmationSms({ bayLabel, startsAt, endsAt, bookingId }),
        tag: 'booking-confirmation',
        transactional: true,
      }),
    ])

    return { sent: true }
  },
)

// Fires at booking start time - 1 hour — sends access code reminder SMS
export const bookingReminder = inngest.createFunction(
  { id: 'booking-reminder', retries: 2 },
  { event: 'booking/created' },
  async ({ event, step }) => {
    const { bookingId, userId } = event.data

    const [booking] = await db
      .select({ startsAt: bookings.startsAt, bayId: bookings.bayId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) return { skipped: true }

    const reminderAt = new Date(booking.startsAt.getTime() - 60 * 60_000)

    await step.sleepUntil('wait-for-reminder-time', reminderAt)

    // Re-check booking hasn't been cancelled
    const [current] = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!current || current.status === 'cancelled') return { skipped: true, reason: 'cancelled' }

    const [bay] = await db
      .select({ label: bays.label })
      .from(bays)
      .where(eq(bays.id, booking.bayId))
      .limit(1)

    await sendUserSms({
      userId,
      content: bookingReminderSms({
        bayLabel: bay?.label ?? 'your bay',
        startsAt: booking.startsAt.toISOString(),
      }),
      tag: 'booking-reminder',
      transactional: true,
    })

    return { sent: true }
  },
)
