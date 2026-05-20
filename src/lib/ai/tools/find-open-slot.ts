import { registerTool } from './index'
import { getAvailability } from '@/lib/booking/service'
import { env } from '@/env'
import { formatInTimeZone } from 'date-fns-tz'
import { format, addDays } from 'date-fns'

const FACILITY_TZ = 'America/New_York'

registerTool({
  definition: {
    name: 'find_open_slot',
    description:
      'Find available bay time slots for a given date and session duration. ' +
      'Use when a customer asks about availability or wants to know when they can book.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (ET). Defaults to tomorrow if not specified.',
        },
        duration_minutes: {
          type: 'number',
          enum: [60, 90, 120],
          description: 'Session length in minutes. Default 60.',
        },
      },
      required: [],
    },
  },

  async execute(input, _ctx) {
    const locationId = env.NEXT_PUBLIC_LOCATION_ID
    const date = (input['date'] as string | undefined) ?? format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const duration = (input['duration_minutes'] as number | undefined) ?? 60

    const availability = await getAvailability({ locationId, date, durationMinutes: duration })
    const slots = availability.slots.filter(slot => slot.available)

    if (slots.length === 0) {
      return JSON.stringify({
        available: false,
        date,
        message: `No available slots on ${date} for a ${duration}-minute session. Suggest the customer try a different date.`,
      })
    }

    const formatted = formatInTimeZone(new Date(`${date}T12:00:00Z`), FACILITY_TZ, 'EEEE, MMMM d')
    const summary = slots
      .slice(0, 8)
      .map(slot => {
        const time = formatInTimeZone(new Date(slot.startsAt), FACILITY_TZ, 'h:mm a')
        return `${time}: ${slot.spotsRemaining} spot${slot.spotsRemaining === 1 ? '' : 's'} open`
      })
      .join('\n')

    return JSON.stringify({
      available: true,
      date: formatted,
      duration_minutes: duration,
      slots_shown: Math.min(slots.length, 8),
      total_slots: slots.length,
      summary,
      booking_url: `${process.env['NEXT_PUBLIC_APP_URL']}/book`,
    })
  },
})
