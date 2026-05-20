import { type NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/env'
import { db } from '@/db'
import { auditLog, memberships, payments } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

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
      const result = await confirmHoldAsBooking({
        holdId,
        type: bookingType,
        totalCents,
        paymentIntentId: 'id' in obj ? String(obj.id) : undefined,
      })
      if ('error' in result) {
        // Flag for manual reconciliation / refund.
        console.error('hold_confirm_failed', { holdId, error: result.error, eventId: event.id })
      }
    }
  }

  if (event.type === 'invoice.paid') {
    await syncMembershipRenewalFromInvoice(event.data.object as Stripe.Invoice)
  }

  return NextResponse.json({ received: true })
}

async function syncMembershipRenewalFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const periodEnd = getSubscriptionCurrentPeriodEnd(subscription)
  if (!periodEnd) {
    throw new Error(`Missing current period end for subscription ${subscriptionId}`)
  }

  const [membership] = await db
    .select({ id: memberships.id, userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.stripeSubscriptionId, subscriptionId))
    .limit(1)

  if (!membership) return

  const paymentIntentId = getInvoicePaymentIntentId(invoice)
  await db
    .update(memberships)
    .set({
      status: 'active',
      currentPeriodEnd: periodEnd,
      stripePaymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(memberships.id, membership.id))

  const paymentRef = invoice.id
  if (paymentRef && invoice.amount_paid > 0) {
    const existingPayment = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.processorRef, paymentRef))
      .limit(1)

    if (existingPayment.length === 0) {
      await db.insert(payments).values({
        id: nanoid(),
        userId: membership.userId,
        membershipId: membership.id,
        amountCents: invoice.amount_paid,
        processor: 'stripe',
        processorRef: paymentRef,
        type: 'charge',
        status: 'succeeded',
        idempotencyKey: `membership-renewal-${paymentRef}`,
        description: 'Membership renewal',
      })
    }
  }

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'system',
    actorId: 'stripe-webhook',
    action: 'membership.renewed',
    targetType: 'membership',
    targetId: membership.id,
    payloadJson: {
      invoiceId: invoice.id,
      subscriptionId,
      paymentIntentId,
      amountCents: invoice.amount_paid,
      currentPeriodEnd: periodEnd.toISOString(),
    },
    at: new Date(),
  })
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : subscription.id
}

function getInvoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const paymentIntent = (invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent
  if (!paymentIntent) return null
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const currentPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  return currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null
}
