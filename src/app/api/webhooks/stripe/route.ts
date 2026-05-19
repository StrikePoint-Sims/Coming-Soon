import { type NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/env'
import { db } from '@/db'
import { auditLog } from '@/db/schema'
import { nanoid } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  if (!env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Log every webhook for observability — handlers added per week as features land
  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'system',
    actorId: 'stripe-webhook',
    action: `stripe.${event.type}`,
    targetType: 'stripe_event',
    targetId: event.id,
    payloadJson: { type: event.type },
    at: new Date(),
  }).catch(console.error)

  // Convert hold → confirmed booking after payment. Re-checks state inside a
  // tx so a late webhook (after hold expiry) does not produce a phantom booking.
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj = event.data.object as { metadata?: Record<string, string>; amount_total?: number; amount?: number }
    const holdId = obj.metadata?.holdId
    const bookingType = (obj.metadata?.bookingType ?? 'walk_in') as
      'member' | 'walk_in' | 'day_pass' | 'trial' | 'corporate' | 'league' | 'lesson'
    if (holdId) {
      const { confirmHoldAsBooking } = await import('@/lib/booking/createHold')
      const totalCents = obj.amount_total ?? obj.amount ?? 0
      const result = await confirmHoldAsBooking({ holdId, type: bookingType, totalCents })
      if ('error' in result) {
        // Flag for manual reconciliation / refund.
        console.error('hold_confirm_failed', { holdId, error: result.error, eventId: event.id })
      }
    }
  }

  return NextResponse.json({ received: true })
}
