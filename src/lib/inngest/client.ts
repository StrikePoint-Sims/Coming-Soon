import { Inngest } from 'inngest'
import { env } from '@/env'

export const inngest = new Inngest({
  id: 'strikepointsims',
  eventKey: env.INNGEST_EVENT_KEY ?? '',
})

// ── Typed event map ───────────────────────────────────────────────────────────
// Add events here as new Inngest functions are introduced.

export type Events = {
  'booking/created': {
    data: { bookingId: string; userId: string; locationId: string }
  }
  'booking/cancelled': {
    data: { bookingId: string; userId: string; refundCents: number }
  }
  'access-code/activate': {
    data: { accessCodeId: string; bookingId: string }
  }
  'access-code/expire': {
    data: { accessCodeId: string; bookingId: string }
  }
  'access-code/send-reminder': {
    data: { bookingId: string; userId: string; phone: string; code: string }
  }
  'payment/failed': {
    data: { userId: string; membershipId: string; attemptNumber: number }
  }
  'waiver/guest-reminder': {
    // guestId targets the specific guest row; bookingId is kept for legacy
    // events that pre-date the per-guest field.
    data: { guestId?: string; bookingId: string }
  }
  'bay/health-check': {
    data: { locationId: string }
  }
  'ai/escalation': {
    data: { threadId: string; summary: string; userId?: string }
  }
  'comms/post-visit-rating': {
    data: { bookingId: string; userId: string; phone: string }
  }
}
