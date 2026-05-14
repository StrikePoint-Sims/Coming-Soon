import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { guestWaiverReminder } from '@/lib/inngest/functions/guest-waiver-reminder'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [guestWaiverReminder],
})
