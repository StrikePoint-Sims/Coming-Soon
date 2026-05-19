'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bookingHolds, waiverSignings, auditLog, payments, bays } from '@/db/schema'
import { eq, and, gt, lt } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { calculatePriceCents, CT_SALES_TAX } from '@/lib/booking/pricing'
import { stripe } from '@/lib/stripe/client'

const FACILITY_TZ = 'America/New_York'

const HOLD_TTL_MINUTES = 10

// Create a hold for a (bay, time) pair. Replaces any existing hold by this user.
export async function createHold(params: {
  locationId: string
  bayId: string
  startsAt: string
  endsAt: string
  partySize?: number
}): Promise<{ holdId: string } | { error: string } | { needsAuth: true }> {
  const session = await auth()
  if (!session?.user?.id) return { needsAuth: true }

  // Must have a valid waiver
  const [waiver] = await db
    .select({ id: waiverSignings.id })
    .from(waiverSignings)
    .where(and(
      eq(waiverSignings.userId, session.user.id),
      gt(waiverSignings.expiresAt, new Date()),
    ))
    .limit(1)
  if (!waiver) return { error: 'A signed waiver is required before booking.' }

  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000)

  // Delete any prior hold by this user (one hold at a time)
  await db.delete(bookingHolds).where(eq(bookingHolds.userId, session.user.id))

  const id = nanoid()
  await db.insert(bookingHolds).values({
    id,
    locationId: params.locationId,
    bayId: params.bayId,
    userId: session.user.id,
    startsAt: new Date(params.startsAt),
    endsAt: new Date(params.endsAt),
    expiresAt,
    partySize: Math.min(4, Math.max(1, params.partySize ?? 1)),
  })

  return { holdId: id }
}

// Confirm a hold into a real booking (atomic: check no conflict, then insert).
export async function confirmBooking(holdId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [hold] = await db
    .select()
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, holdId),
      eq(bookingHolds.userId, session.user.id),
      gt(bookingHolds.expiresAt, new Date()),
    ))
    .limit(1)

  if (!hold) throw new Error('Hold expired or not found. Please select a time again.')

  // Check for conflicts introduced since the hold was created
  const conflict = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.bayId, hold.bayId),
      eq(bookings.locationId, hold.locationId),
      lt(bookings.startsAt, hold.endsAt),
      gt(bookings.endsAt, hold.startsAt),
    ))
    .limit(1)

  if (conflict.length > 0) throw new Error('This slot was just booked by someone else. Please choose a different time.')

  const userId = session.user!.id!
  const bookingId = nanoid()

  // neon-http doesn't support transactions; sequential writes with the
  // booking insert as the critical step. Hold + audit are best-effort cleanup.
  await db.insert(bookings).values({
    id: bookingId,
    locationId: hold.locationId,
    bayId: hold.bayId,
    userId,
    type: 'member',
    startsAt: hold.startsAt,
    endsAt: hold.endsAt,
    partySize: hold.partySize,
    status: 'confirmed',
    source: 'web',
    totalCents: 0,
  })
  await db.delete(bookingHolds).where(eq(bookingHolds.id, holdId))
  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: userId,
    action: 'booking.created',
    targetType: 'booking',
    targetId: bookingId,
    payloadJson: { bayId: hold.bayId, startsAt: hold.startsAt.toISOString() },
    at: new Date(),
  })

  await inngest.send({
    name: 'booking/created',
    data: { bookingId, userId, locationId: hold.locationId },
  })

  revalidatePath('/account')
  redirect(`/book/${bookingId}`)
}

// ── New actions for Review & Pay flow ─────────────────────────────────────────

export interface HoldDetails {
  holdId: string
  bayLabel: string
  startsAt: string   // ISO UTC
  endsAt: string     // ISO UTC
  durationMinutes: number
  dateLabel: string  // "Tue, May 20"
  timeRange: string  // "9:00 AM – 10:30 AM"
}

export async function getHoldDetails(holdId: string): Promise<HoldDetails | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const now = new Date()
  const [hold] = await db
    .select()
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, holdId),
      eq(bookingHolds.userId, session.user.id),
      gt(bookingHolds.expiresAt, now),
    ))
    .limit(1)

  if (!hold) return { error: 'Hold expired or not found.' }

  const [bay] = await db
    .select({ label: bays.label })
    .from(bays)
    .where(eq(bays.id, hold.bayId))
    .limit(1)

  const durationMs = hold.endsAt.getTime() - hold.startsAt.getTime()
  const durationMinutes = Math.round(durationMs / 60_000)

  const dateLabel = formatInTimeZone(hold.startsAt, FACILITY_TZ, 'EEE, MMM d')
  const startLabel = formatInTimeZone(hold.startsAt, FACILITY_TZ, 'h:mm a')
  const endLabel = formatInTimeZone(hold.endsAt, FACILITY_TZ, 'h:mm a')

  return {
    holdId: hold.id,
    bayLabel: bay?.label ?? 'Bay',
    startsAt: hold.startsAt.toISOString(),
    endsAt: hold.endsAt.toISOString(),
    durationMinutes,
    dateLabel,
    timeRange: `${startLabel} – ${endLabel}`,
  }
}

export interface PaymentIntentResult {
  clientSecret: string
  subtotalCents: number
  taxCents: number
  totalCents: number
}

export async function createPaymentIntent(
  holdId: string,
): Promise<PaymentIntentResult | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const now = new Date()
  const [hold] = await db
    .select()
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, holdId),
      eq(bookingHolds.userId, session.user.id),
      gt(bookingHolds.expiresAt, now),
    ))
    .limit(1)

  if (!hold) return { error: 'Hold expired or not found. Please select a new time.' }

  // Calculate price using ET start hour
  const startET = toZonedTime(hold.startsAt, FACILITY_TZ)
  const durationMs = hold.endsAt.getTime() - hold.startsAt.getTime()
  const durationMinutes = Math.round(durationMs / 60_000)
  const subtotalCents = calculatePriceCents(startET.getHours(), startET.getMinutes(), durationMinutes, startET.getDay())
  const taxCents = Math.round(subtotalCents * CT_SALES_TAX)
  const totalCents = subtotalCents + taxCents

  const pi = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      holdId,
      userId: session.user.id,
      bayId: hold.bayId,
      startsAt: hold.startsAt.toISOString(),
      endsAt: hold.endsAt.toISOString(),
    },
  })

  if (!pi.client_secret) return { error: 'Payment setup failed. Please try again.' }

  return { clientSecret: pi.client_secret, subtotalCents, taxCents, totalCents }
}

export async function confirmBookingAfterPayment(
  holdId: string,
  paymentIntentId: string,
): Promise<{ bookingId: string; partySize: number } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  // Verify payment succeeded
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (pi.status !== 'succeeded') {
    return { error: 'Payment not yet confirmed. Please wait a moment and try again.' }
  }

  const [hold] = await db
    .select()
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, holdId),
      eq(bookingHolds.userId, session.user.id),
    ))
    .limit(1)

  if (!hold) return { error: 'Hold not found. Your booking may already be confirmed.' }

  // Check for conflicts
  const conflict = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.bayId, hold.bayId),
      eq(bookings.locationId, hold.locationId),
      lt(bookings.startsAt, hold.endsAt),
      gt(bookings.endsAt, hold.startsAt),
    ))
    .limit(1)

  if (conflict.length > 0) {
    return { error: 'This slot was booked by someone else while you were paying. Please contact us.' }
  }

  const startET = toZonedTime(hold.startsAt, FACILITY_TZ)
  const durationMs = hold.endsAt.getTime() - hold.startsAt.getTime()
  const durationMinutes = Math.round(durationMs / 60_000)
  const subtotalCents = calculatePriceCents(startET.getHours(), startET.getMinutes(), durationMinutes, startET.getDay())
  const taxCents = Math.round(subtotalCents * CT_SALES_TAX)
  const totalCents = subtotalCents + taxCents

  const userId = session.user.id
  const bookingId = nanoid()
  const paymentId = nanoid()

  // neon-http doesn't support transactions; sequential writes. Stripe is the
  // source of truth for payment — local payment row + audit are bookkeeping.
  await db.insert(bookings).values({
    id: bookingId,
    locationId: hold.locationId,
    bayId: hold.bayId,
    userId,
    type: 'member',
    startsAt: hold.startsAt,
    endsAt: hold.endsAt,
    partySize: hold.partySize,
    status: 'confirmed',
    source: 'web',
    totalCents,
    paidAt: new Date(),
  })
  await db.insert(payments).values({
    id: paymentId,
    userId,
    bookingId,
    amountCents: totalCents,
    processor: 'stripe',
    processorRef: paymentIntentId,
    type: 'charge',
    status: 'succeeded',
    idempotencyKey: `booking-${bookingId}`,
    description: `Bay booking ${bookingId}`,
  })
  await db.delete(bookingHolds).where(eq(bookingHolds.id, holdId))
  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: userId,
    action: 'booking.created',
    targetType: 'booking',
    targetId: bookingId,
    payloadJson: {
      bayId: hold.bayId,
      startsAt: hold.startsAt.toISOString(),
      totalCents,
      paymentIntentId,
    },
    at: new Date(),
  })

  await inngest.send({
    name: 'booking/created',
    data: { bookingId, userId, locationId: hold.locationId },
  })

  revalidatePath('/account')
  return { bookingId, partySize: hold.partySize }
}

// Release a hold (user clicked back)
export async function releaseHold(holdId: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) return
  await db.delete(bookingHolds).where(and(
    eq(bookingHolds.id, holdId),
    eq(bookingHolds.userId, session.user.id),
  ))
}
