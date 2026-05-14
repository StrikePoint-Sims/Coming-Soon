import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { guestWaiverReminder } from '@/lib/inngest/functions/guest-waiver-reminder'
import { bookingConfirmation, bookingReminder } from '@/lib/inngest/functions/booking-comms'
import { holdSweep } from '@/lib/inngest/functions/hold-sweep'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    guestWaiverReminder,
    bookingConfirmation,
    bookingReminder,
    holdSweep,
  ],
})
