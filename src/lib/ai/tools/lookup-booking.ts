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
      'Look up the signed-in customer\'s recent or upcoming bookings. ' +
      'Use when the customer asks about their reservation or upcoming session. ' +
      'Returns an error if the customer is not signed in — in that case ask them to log in.',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: {
          type: 'string',
          description:
            "Optional booking reference the customer mentioned (e.g. 'b_abc123'). " +
            'When provided, the booking is only returned if it belongs to the signed-in user.',
        },
      },
      required: [],
    },
  },

  async execute(input, ctx) {
    // The userId is sourced from the server-verified session — never from the LLM.
    const { userId } = ctx
    if (!userId) {
      return JSON.stringify({
        found: false,
        message:
          'The customer is not signed in. Ask them to sign in at /login so I can pull up their bookings.',
      })
    }

    const bookingId = typeof input['booking_id'] === 'string' ? input['booking_id'] : undefined

    const whereExpr = bookingId
      ? and(eq(bookings.userId, userId), eq(bookings.id, bookingId))
      : eq(bookings.userId, userId)

    const results = await db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
        bayLabel: bays.label,
      })
      .from(bookings)
      .leftJoin(bays, eq(bookings.bayId, bays.id))
      .where(whereExpr)
      .orderBy(desc(bookings.startsAt))
      .limit(5)

    if (results.length === 0) {
      return JSON.stringify({ found: false, message: 'No bookings found for this customer.' })
    }

    const formatted = results.map((b) => ({
      bookingId: b.id,
      bay: b.bayLabel ?? 'TBD',
      date: formatInTimeZone(b.startsAt, FACILITY_TZ, 'EEEE, MMMM d, yyyy'),
      time: `${formatInTimeZone(b.startsAt, FACILITY_TZ, 'h:mm a')} – ${formatInTimeZone(b.endsAt, FACILITY_TZ, 'h:mm a')}`,
      status: b.status,
    }))

    return JSON.stringify({ found: true, bookings: formatted })
  },
})
