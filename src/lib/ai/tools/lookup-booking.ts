import { registerTool } from './index'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'

const FACILITY_TZ = 'America/New_York'

registerTool({
  definition: {
    name: 'lookup_booking',
    description:
      'Look up booking details for a customer. Use when a customer asks about their reservation, ' +
      'upcoming session, or references a booking ID.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'The authenticated user ID (from session context).',
        },
        booking_id: {
          type: 'string',
          description: 'Specific booking ID if the customer provided one.',
        },
      },
      required: [],
    },
  },

  async execute(input) {
    const userId = input['user_id'] as string | undefined
    const bookingId = input['booking_id'] as string | undefined

    if (!userId && !bookingId) {
      return JSON.stringify({
        found: false,
        message: 'No user ID or booking ID provided. Ask the customer for their booking reference or to log in.',
      })
    }

    let query = db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
        bayLabel: bays.label,
      })
      .from(bookings)
      .innerJoin(bays, eq(bookings.bayId, bays.id))
      .orderBy(desc(bookings.startsAt))
      .limit(5)

    if (bookingId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(bookings.id, bookingId)) as any
    } else if (userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(and(eq(bookings.userId, userId))) as any
    }

    const results = await query

    if (results.length === 0) {
      return JSON.stringify({ found: false, message: 'No bookings found.' })
    }

    const formatted = results.map((b) => ({
      bookingId: b.id,
      bay: b.bayLabel,
      date: formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEEE, MMMM d, yyyy'),
      time: `${formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} – ${formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}`,
      status: b.status,
    }))

    return JSON.stringify({ found: true, bookings: formatted })
  },
})
