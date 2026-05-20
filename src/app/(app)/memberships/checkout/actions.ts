'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, memberships, membershipTiers, payments, users } from '@/db/schema'
import { env } from '@/env'
import { MEMBERSHIP_PLANS, membershipAmountCents, parseBilling, parsePlanId, planIdForTierName, type MembershipBilling, type MembershipPlanId } from '@/lib/memberships/plans'
import { stripe } from '@/lib/stripe/client'
import { nanoid } from '@/lib/utils'
import { and, eq, gt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'

export interface MembershipCheckoutIntent {
  clientSecret: string
  subscriptionId: string | null
  amountCents: number
  planName: string
  billing: MembershipBilling
  mode: 'new' | 'upgrade'
  currentPlanName?: string
  fullAmountCents?: number
  proratedDays?: number
  prorationBaseDays?: number
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
  const activeMembership = await getActiveMembership(user.id)
  const activePlanId = planIdForTierName(activeMembership?.tierName)
  const isUpgrade = activeMembership && activePlanId && plan.sortOrder > MEMBERSHIP_PLANS[activePlanId].sortOrder

  if (activeMembership && !isUpgrade) {
    return { error: 'This plan is not an upgrade from your current membership.' }
  }

  if (isUpgrade && activeMembership && activePlanId) {
    if (!activeMembership.stripeSubscriptionId) {
      return { error: 'This membership is missing its billing subscription.' }
    }

    const currentPlan = MEMBERSHIP_PLANS[activePlanId]
    const amountCents = calculateUpgradeProrationCents({
      currentMonthlyCents: currentPlan.monthlyPriceCents,
      targetMonthlyCents: plan.monthlyPriceCents,
      now: new Date(),
      currentPeriodEnd: activeMembership.currentPeriodEnd,
    })

    if (amountCents <= 0) return { error: 'No upgrade charge is due right now.' }

    const pi = await stripe.paymentIntents.create({
      customer: customerId,
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
      metadata: {
        userId: user.id,
        membershipId: activeMembership.id,
        subscriptionId: activeMembership.stripeSubscriptionId,
        currentPlan: activePlanId,
        plan: planId,
        tierId,
        billing,
        mode: 'upgrade',
      },
    })

    if (!pi.client_secret) {
      return { error: 'Could not start membership upgrade. Please try again.' }
    }

    const proration = calculateUpgradeProrationDetails({
      currentMonthlyCents: currentPlan.monthlyPriceCents,
      targetMonthlyCents: plan.monthlyPriceCents,
      now: new Date(),
      currentPeriodEnd: activeMembership.currentPeriodEnd,
    })

    await db.insert(auditLog).values({
      id: nanoid(),
      actorType: 'user',
      actorId: user.id,
      action: 'membership.upgrade.checkout.started',
      targetType: 'membership',
      targetId: activeMembership.id,
      payloadJson: { fromPlan: activePlanId, toPlan: planId, billing, subscriptionId: activeMembership.stripeSubscriptionId, ...proration },
      at: new Date(),
    })

    return {
      clientSecret: pi.client_secret,
      subscriptionId: null,
      amountCents,
      planName: plan.name,
      billing,
      mode: 'upgrade',
      currentPlanName: currentPlan.name,
      fullAmountCents: plan.monthlyPriceCents - currentPlan.monthlyPriceCents,
      proratedDays: proration.daysRemaining,
      prorationBaseDays: proration.daysInMonth,
    }
  }

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
    mode: 'new',
  }
}

export async function activateMembershipAfterPayment(params: {
  subscriptionId: string | null
  paymentIntentId: string
}): Promise<{ membershipId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Please sign in to continue.' }

  const user = await getCheckoutUser(session.user.id)
  if (!user?.stripeCustomerId) return { error: 'Stripe customer not found.' }

  if (!params.subscriptionId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(params.paymentIntentId)
    if (paymentIntent.status !== 'succeeded') return { error: 'Payment has not completed yet.' }
    if (paymentIntent.metadata?.['userId'] !== user.id || paymentIntent.metadata?.['mode'] !== 'upgrade') {
      return { error: 'This checkout does not belong to your account.' }
    }

    const membershipId = paymentIntent.metadata?.['membershipId']
    const subscriptionId = paymentIntent.metadata?.['subscriptionId']
    const planId = parsePlanId(paymentIntent.metadata?.['plan'])
    const billing = parseBilling(paymentIntent.metadata?.['billing'])
    const tierId = paymentIntent.metadata?.['tierId'] || await ensureMembershipTier(planId)
    if (!membershipId) return { error: 'Membership not found for this upgrade.' }
    if (!subscriptionId) return { error: 'Billing subscription not found for this upgrade.' }

    await updateStripeSubscriptionForUpgrade({
      subscriptionId,
      customerId: user.stripeCustomerId,
      userId: user.id,
      planId,
      tierId,
      billing,
      paymentIntent,
    })

    await db
      .update(memberships)
      .set({
        tierId,
        status: 'active',
        stripeSubscriptionId: subscriptionId,
        stripePaymentIntentId: paymentIntent.id,
        isAnnual: billing === 'annual',
        updatedAt: new Date(),
      })
      .where(and(eq(memberships.id, membershipId), eq(memberships.userId, user.id)))

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
        amountCents: paymentIntent.amount,
        processor: 'stripe',
        processorRef: paymentIntent.id,
        type: 'charge',
        status: 'succeeded',
        idempotencyKey: `membership-upgrade-${paymentIntent.id}`,
        description: `${MEMBERSHIP_PLANS[planId].name} membership upgrade proration`,
      })
    }

    await db.insert(auditLog).values({
      id: nanoid(),
      actorType: 'user',
      actorId: user.id,
      action: 'membership.upgraded',
      targetType: 'membership',
      targetId: membershipId,
      payloadJson: {
        plan: planId,
        billing,
        subscriptionId,
        paymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
        recurringAmountCents: membershipAmountCents(MEMBERSHIP_PLANS[planId], billing),
      },
      at: new Date(),
    })

    revalidatePath('/account')
    revalidatePath('/account/membership-billing')
    return { membershipId }
  }

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

async function getActiveMembership(userId: string) {
  const [membership] = await db
    .select({
      id: memberships.id,
      tierName: membershipTiers.name,
      currentPeriodEnd: memberships.currentPeriodEnd,
      stripeSubscriptionId: memberships.stripeSubscriptionId,
      isAnnual: memberships.isAnnual,
    })
    .from(memberships)
    .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
    .where(and(
      eq(memberships.userId, userId),
      gt(memberships.currentPeriodEnd, new Date()),
    ))
    .limit(1)

  return membership ?? null
}

async function updateStripeSubscriptionForUpgrade(params: {
  subscriptionId: string
  customerId: string
  userId: string
  planId: MembershipPlanId
  tierId: string
  billing: MembershipBilling
  paymentIntent: Stripe.PaymentIntent
}) {
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId)
  if (subscription.customer !== params.customerId) {
    throw new Error('Upgrade subscription does not belong to this customer.')
  }

  const itemId = subscription.items.data[0]?.id
  if (!itemId) {
    throw new Error('Upgrade subscription has no billable item.')
  }

  const price = await createStripeMembershipPrice(params.planId, params.billing)
  const defaultPaymentMethod = getPaymentMethodId(params.paymentIntent.payment_method)
  const updateParams: Stripe.SubscriptionUpdateParams = {
    items: [{ id: itemId, price: price.id }],
    proration_behavior: 'none',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    metadata: {
      ...subscription.metadata,
      userId: params.userId,
      tierId: params.tierId,
      plan: params.planId,
      billing: params.billing,
    },
  }

  if (defaultPaymentMethod) updateParams.default_payment_method = defaultPaymentMethod
  await stripe.subscriptions.update(subscription.id, updateParams)
}

async function createStripeMembershipPrice(planId: MembershipPlanId, billing: MembershipBilling): Promise<Stripe.Price> {
  const plan = MEMBERSHIP_PLANS[planId]
  const interval = billing === 'annual' ? 'year' : 'month'
  const product = await stripe.products.create({
    name: `StrikePoint Sims ${plan.name} Membership`,
    metadata: { plan: planId },
  })

  return stripe.prices.create({
    currency: 'usd',
    product: product.id,
    recurring: { interval },
    unit_amount: membershipAmountCents(plan, billing),
    metadata: { plan: planId, billing },
  })
}

function getPaymentMethodId(paymentMethod: string | Stripe.PaymentMethod | null): string | undefined {
  if (!paymentMethod) return undefined
  return typeof paymentMethod === 'string' ? paymentMethod : paymentMethod.id
}

function calculateUpgradeProrationDetails(params: {
  currentMonthlyCents: number
  targetMonthlyCents: number
  now: Date
  currentPeriodEnd: Date
}) {
  const differenceCents = Math.max(0, params.targetMonthlyCents - params.currentMonthlyCents)
  const daysInMonth = new Date(params.now.getFullYear(), params.now.getMonth() + 1, 0).getDate()
  const msRemaining = Math.max(0, params.currentPeriodEnd.getTime() - params.now.getTime())
  const daysRemaining = Math.min(daysInMonth, Math.max(0, Math.ceil(msRemaining / 86_400_000)))
  const amountCents = Math.round((differenceCents * daysRemaining) / daysInMonth)
  return { differenceCents, daysRemaining, daysInMonth, amountCents }
}

function calculateUpgradeProrationCents(params: {
  currentMonthlyCents: number
  targetMonthlyCents: number
  now: Date
  currentPeriodEnd: Date
}) {
  return calculateUpgradeProrationDetails(params).amountCents
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
