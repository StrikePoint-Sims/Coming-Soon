import { inngest } from '@/lib/inngest/client'
import { db } from '@/db'
import { auditLog, bookings, bays, users, accessCodes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { nanoid } from '@/lib/utils'
import { sendUserEmail, sendUserSms } from '@/lib/comms'
import { bookingConfirmationEmail, bookingConfirmationSms, bookingReminderSms } from '@/lib/comms/templates'

// Cryptographically random 6-digit code. This gates physical access to the
// facility — Math.random() is not acceptable here.
function generateAccessCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

// Fires immediately after booking/created — sends confirmation and creates access code row
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

    const [bay] = booking.bayId
      ? await db
        .select({ label: bays.label })
        .from(bays)
        .where(eq(bays.id, booking.bayId))
        .limit(1)
      : []

    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const startsAt = booking.startsAt.toISOString()
    const endsAt = booking.endsAt.toISOString()
    const bayLabel = bay?.label ?? 'your bay'
    const firstName = user?.name?.split(' ')[0] ?? 'there'

    // Generate access code — valid from T-5min to T+5min after session end
    // OpenPath activation/expiry (T-5 and T+0) wired in Week 6
    const validFrom = new Date(booking.startsAt.getTime() - 5 * 60_000)
    const validTo = new Date(booking.endsAt.getTime() + 5 * 60_000)

    await db.insert(accessCodes).values({
      id: nanoid(),
      bookingId,
      code: generateAccessCode(),
      validFrom,
      validTo,
      status: 'pending',
    })

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

// Fires at T-1h — sends SMS with the actual access code
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

    const [bay] = booking.bayId
      ? await db
        .select({ label: bays.label })
        .from(bays)
        .where(eq(bays.id, booking.bayId))
        .limit(1)
      : []

    // Look up the access code for this booking
    const [accessCode] = await db
      .select({ id: accessCodes.id, code: accessCodes.code })
      .from(accessCodes)
      .where(eq(accessCodes.bookingId, bookingId))
      .limit(1)

    if (!accessCode) return { skipped: true, reason: 'no access code found' }

    await sendUserSms({
      userId,
      content: bookingReminderSms({
        bayLabel: bay?.label ?? 'your bay',
        startsAt: booking.startsAt.toISOString(),
        code: accessCode.code,
      }),
      tag: 'booking-reminder',
      transactional: true,
    })

    // Mark code as sent
    await db
      .update(accessCodes)
      .set({ sentAt: new Date() })
      .where(eq(accessCodes.id, accessCode.id))

    await db.insert(auditLog).values({
      id: nanoid(),
      actorType: 'system',
      actorId: 'inngest:booking-reminder',
      action: 'access_code.sms_sent',
      targetType: 'booking',
      targetId: bookingId,
      payloadJson: { accessCodeId: accessCode.id },
      at: new Date(),
    })

    return { sent: true, code: accessCode.code }
  },
)
