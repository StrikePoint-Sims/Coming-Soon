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

  // Week 5 handlers: invoice.paid, invoice.payment_failed, customer.subscription.*,
  // payment_intent.succeeded, payment_intent.payment_failed, charge.refunded

  return NextResponse.json({ received: true })
}
