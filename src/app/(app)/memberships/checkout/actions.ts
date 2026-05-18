'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, memberships, membershipTiers, payments, users } from '@/db/schema'
import { env } from '@/env'
import { MEMBERSHIP_PLANS, membershipAmountCents, parseBilling, parsePlanId, type MembershipBilling, type MembershipPlanId } from '@/lib/memberships/plans'
import { stripe } from '@/lib/stripe/client'
import { nanoid } from '@/lib/utils'
import { and, eq, gt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'

export interface MembershipCheckoutIntent {
  clientSecret: string
  subscriptionId: string
  amountCents: number
  planName: string
  billing: MembershipBilling
}

export async function createMembershipCheckoutIntent(params: {
  plan: string
  billing: string
}): Promise<MembershipCheckoutIntent | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to continue.' }
  if (!env.STRIPE_SECRET_KEY) return { error: 'Stripe is not configured.' }

  const planId = parsePlanId(params.plan)
  const billing = parseBilling(params.billing)
  const plan = MEMBERSHIP_PLANS[planId]
  const tierId = await ensureMembershipTier(planId)
  const user = await getCheckoutUser(session.user.id)
  if (!user) return { error: 'Account not found.' }

  const customerId = await getOrCreateStripeCustomer(user)
  const amountCents = membershipAmountCents(plan, billing)
  const interval = billing === 'annual' ? 'year' : 'month'
  const product = await stripe.products.create({
    name: `StrikePoint Sims ${plan.name} Membership`,
    metadata: { plan: planId },
  })

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price_data: {
          currency: 'usd',
          product: product.id,
          recurring: { interval },
          unit_amount: amountCents,
        },
      },
    ],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      userId: user.id,
      tierId,
      plan: planId,
      billing,
    },
  })

  const paymentIntent = getSubscriptionPaymentIntent(subscription)
  if (!paymentIntent?.client_secret) {
    return { error: 'Could not start membership checkout. Please try again.' }
  }

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: user.id,
    action: 'membership.checkout.started',
    targetType: 'stripe_subscription',
    targetId: subscription.id,
    payloadJson: { plan: planId, billing, amountCents },
    at: new Date(),
  })

  return {
    clientSecret: paymentIntent.client_secret,
    subscriptionId: subscription.id,
    amountCents,
    planName: plan.name,
    billing,
  }
}

export async function activateMembershipAfterPayment(params: {
  subscriptionId: string
  paymentIntentId: string
}): Promise<{ membershipId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to continue.' }

  const user = await getCheckoutUser(session.user.id)
  if (!user?.stripeCustomerId) return { error: 'Stripe customer not found.' }

  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ['latest_invoice.payment_intent'],
  })

  if (subscription.customer !== user.stripeCustomerId) {
    return { error: 'This checkout does not belong to your account.' }
  }

  const metadataUserId = subscription.metadata?.['userId']
  if (metadataUserId && metadataUserId !== user.id) {
    return { error: 'This checkout does not belong to your account.' }
  }

  const paymentIntent = getSubscriptionPaymentIntent(subscription)
  if (!paymentIntent || paymentIntent.id !== params.paymentIntentId || paymentIntent.status !== 'succeeded') {
    return { error: 'Payment has not completed yet.' }
  }

  const planId = parsePlanId(subscription.metadata?.['plan'])
  const billing = parseBilling(subscription.metadata?.['billing'])
  const tierId = subscription.metadata?.['tierId'] || await ensureMembershipTier(planId)
  const periodEnd = getSubscriptionPeriodEnd(subscription, billing)
  const amountCents = membershipAmountCents(MEMBERSHIP_PLANS[planId], billing)

  const [existingMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(
      eq(memberships.userId, user.id),
      gt(memberships.currentPeriodEnd, new Date()),
    ))
    .limit(1)

  const membershipId = existingMembership?.id ?? nanoid()
  if (existingMembership) {
    await db
      .update(memberships)
      .set({
        locationId: env.NEXT_PUBLIC_LOCATION_ID,
        tierId,
        status: 'active',
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: subscription.id,
        stripePaymentIntentId: paymentIntent.id,
        isAnnual: billing === 'annual',
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, membershipId))
  } else {
    await db.insert(memberships).values({
      id: membershipId,
      userId: user.id,
      locationId: env.NEXT_PUBLIC_LOCATION_ID,
      tierId,
      status: 'active',
      startedAt: new Date(),
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: subscription.id,
      stripePaymentIntentId: paymentIntent.id,
      isAnnual: billing === 'annual',
    })
  }

  const paymentExists = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.processorRef, paymentIntent.id))
    .limit(1)

  if (paymentExists.length === 0) {
    await db.insert(payments).values({
      id: nanoid(),
      userId: user.id,
      membershipId,
      amountCents,
      processor: 'stripe',
      processorRef: paymentIntent.id,
      type: 'charge',
      status: 'succeeded',
      idempotencyKey: `membership-${subscription.id}-${paymentIntent.id}`,
      description: `${MEMBERSHIP_PLANS[planId].name} membership ${billing}`,
    })
  }

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: user.id,
    action: 'membership.activated',
    targetType: 'membership',
    targetId: membershipId,
    payloadJson: { plan: planId, billing, subscriptionId: subscription.id, paymentIntentId: paymentIntent.id },
    at: new Date(),
  })

  revalidatePath('/account')
  revalidatePath('/account/membership-billing')
  return { membershipId }
}

async function getCheckoutUser(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

async function getOrCreateStripeCustomer(user: NonNullable<Awaited<ReturnType<typeof getCheckoutUser>>>): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
  })

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, user.id))

  return customer.id
}

async function ensureMembershipTier(planId: MembershipPlanId): Promise<string> {
  const plan = MEMBERSHIP_PLANS[planId]
  const tierId = `tier_${plan.id}`

  const [existing] = await db
    .select({ id: membershipTiers.id })
    .from(membershipTiers)
    .where(and(
      eq(membershipTiers.locationId, env.NEXT_PUBLIC_LOCATION_ID),
      eq(membershipTiers.name, plan.name),
    ))
    .limit(1)

  if (existing) return existing.id

  await db.insert(membershipTiers).values({
    id: tierId,
    locationId: env.NEXT_PUBLIC_LOCATION_ID,
    name: plan.name,
    monthlyPriceCents: plan.monthlyPriceCents,
    annualPriceCents: plan.annualPriceCents,
    sessionMinutes: plan.sessionMinutes,
    maxConcurrentBookings: plan.maxConcurrentBookings,
    advanceWindowDays: plan.advanceWindowDays,
    guestAllowance: plan.guestAllowance,
    accessHoursRuleJson: { includedPeakHours: plan.includedPeakHours },
    active: true,
    sortOrder: plan.sortOrder,
  }).onConflictDoNothing()

  return tierId
}

function getSubscriptionPaymentIntent(subscription: Stripe.Subscription): Stripe.PaymentIntent | null {
  const invoice = subscription.latest_invoice
  if (!invoice || typeof invoice === 'string') return null
  const paymentIntent = (invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null }).payment_intent
  if (!paymentIntent || typeof paymentIntent === 'string') return null
  return paymentIntent
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription, billing: MembershipBilling): Date {
  const currentPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  if (currentPeriodEnd) return new Date(currentPeriodEnd * 1000)

  const fallback = new Date()
  if (billing === 'annual') fallback.setFullYear(fallback.getFullYear() + 1)
  else fallback.setMonth(fallback.getMonth() + 1)
  return fallback
}
