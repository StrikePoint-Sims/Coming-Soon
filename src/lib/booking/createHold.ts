import { sql, and, eq, gt, lt, inArray } from 'drizzle-orm'
import { txDb } from './tx'
import { auditLog, bookings, bookingHolds, bookingBlocks, payments } from '@/db/schema'
import {
  CAPACITY_TOTAL,
  DEFAULT_SLOT_MINUTES,
  facilityDatesForRange,
  facilityDateKey,
} from './capacity'
import { clearAvailabilityCacheForRange } from './cache'
import { inngest } from '@/lib/inngest/client'
import { nanoid } from '@/lib/utils'
import { getActiveMembershipHourQuote, insertMembershipHourDebit, refundEligibleMembershipHours } from './membership-hours'
import { calculatePriceCents, CT_SALES_TAX } from './pricing'
import { toZonedTime } from 'date-fns-tz'

const HOLD_TTL_MINUTES = 12
const FNV_OFFSET_BASIS_64 = BigInt('1469598103934665603')
const FNV_PRIME_64 = BigInt('1099511628211')
const UINT64_MASK = BigInt('0xffffffffffffffff')
const PG_BIGINT_MASK = BigInt('0x7fffffffffffffff')

export interface HoldRequest {
  userId: string
  locationId: string
  startsAt: Date
  endsAt: Date
  partySize?: number
}

export interface HoldResult {
  id: string
  expiresAt: Date
}

// Stable bigints for pg_advisory_xact_lock based on local business date.
// Date-level locks are fine for a 3-bay site — see README.
function dateLockKey(date: string): bigint {
  let h = FNV_OFFSET_BASIS_64
  for (let i = 0; i < date.length; i++) {
    h ^= BigInt(date.charCodeAt(i))
    h = (h * FNV_PRIME_64) & UINT64_MASK
  }
  // Postgres bigint is signed; mask to 63 bits.
  return h & PG_BIGINT_MASK
}

// Re-check capacity directly inside the transaction. Half-open overlap.
// `tx` typed loosely; drizzle's transaction handle is structurally compatible
// with the top-level db for the select calls below.
async function consumedCount(
  tx: { select: (typeof txDb)['select'] },
  locationId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<number> {
  const now = new Date()

  const [bks, holds, blks] = await Promise.all([
    tx
      .select({ s: bookings.startsAt, e: bookings.endsAt })
      .from(bookings)
      .where(and(
        eq(bookings.locationId, locationId),
        inArray(bookings.status, ['pending', 'confirmed', 'checked_in']),
        lt(bookings.startsAt, endsAt),
        gt(bookings.endsAt, startsAt),
      )),
    tx
      .select({ s: bookingHolds.startsAt, e: bookingHolds.endsAt })
      .from(bookingHolds)
      .where(and(
        eq(bookingHolds.locationId, locationId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, now),
        lt(bookingHolds.startsAt, endsAt),
        gt(bookingHolds.endsAt, startsAt),
      )),
    tx
      .select({ s: bookingBlocks.startsAt, e: bookingBlocks.endsAt })
      .from(bookingBlocks)
      .where(and(
        eq(bookingBlocks.locationId, locationId),
        lt(bookingBlocks.startsAt, endsAt),
        gt(bookingBlocks.endsAt, startsAt),
      )),
  ])

  const consumers = [...bks, ...holds, ...blks].map(r => ({
    s: new Date(r.s as unknown as string),
    e: new Date(r.e as unknown as string),
  }))

  // Peak overlap across slices (half-open).
  const sliceMs = DEFAULT_SLOT_MINUTES * 60_000
  let peak = 0
  for (let t = startsAt.getTime(); t < endsAt.getTime(); t += sliceMs) {
    const ss = new Date(t)
    const se = new Date(Math.min(t + sliceMs, endsAt.getTime()))
    let n = 0
    for (const c of consumers) if (ss < c.e && se > c.s) n++
    if (n > peak) peak = n
  }
  return peak
}

export class CapacityUnavailableError extends Error {
  constructor() { super('capacity_unavailable') }
}

// Safe transactional hold creation.
// 1. tx begins
// 2. pg_advisory_xact_lock on the affected local date(s)
// 3. re-check capacity against Postgres (NOT the cache)
// 4. insert hold or rollback
// 5. commit
// 6. invalidate availability cache for the affected dates
export async function createHold(req: HoldRequest): Promise<HoldResult> {
  const dates = facilityDatesForRange(req.startsAt, req.endsAt)
  const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000)
  const id = nanoid()

  const result = await txDb.transaction(async (tx) => {
    for (const d of dates) {
      const key = dateLockKey(d)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${key}::bigint)`)
    }

    const peak = await consumedCount(tx, req.locationId, req.startsAt, req.endsAt)
    if (peak + 1 > CAPACITY_TOTAL) throw new CapacityUnavailableError()

    await tx.insert(bookingHolds).values({
      id,
      locationId: req.locationId,
      bayId: null, // assigned later, ~1h before reservation
      userId: req.userId,
      startsAt: req.startsAt,
      endsAt: req.endsAt,
      expiresAt,
      status: 'active',
      partySize: Math.min(4, Math.max(1, req.partySize ?? 1)),
    })

    return { id, expiresAt }
  })

  await clearAvailabilityCacheForRange(req.startsAt, req.endsAt)
  return result
}

// Confirm a hold into a real booking. Used by the Stripe webhook after payment.
// Re-checks hold state + capacity; safe if the webhook arrives after expiry.
export async function confirmHoldAsBooking(params: {
  holdId: string
  type: 'member' | 'walk_in' | 'day_pass' | 'trial' | 'corporate' | 'league' | 'lesson'
  totalCents: number
  paymentIntentId?: string
}): Promise<{ bookingId: string; partySize: number } | { error: 'hold_missing' | 'hold_not_active' | 'capacity_unavailable' | 'payment_mismatch' }> {
  const bookingId = nanoid()
  const paymentId = nanoid()

  const result = await txDb.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.id, params.holdId))
      .limit(1)
    const hold = rows[0]
    if (!hold) return { error: 'hold_missing' as const }
    if (hold.status !== 'active' || new Date(hold.expiresAt as unknown as string) <= new Date()) {
      return { error: 'hold_not_active' as const }
    }

    const startsAt = new Date(hold.startsAt as unknown as string)
    const endsAt = new Date(hold.endsAt as unknown as string)
    const dates = facilityDatesForRange(startsAt, endsAt)
    for (const d of dates) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${dateLockKey(d)}::bigint)`)
    }

    // The active hold is itself counted in `peak`. Converting hold → booking
    // does not change total consumption, so we require peak ≤ CAPACITY_TOTAL.
    const peak = await consumedCount(tx, hold.locationId, startsAt, endsAt)
    if (peak > CAPACITY_TOTAL) return { error: 'capacity_unavailable' as const }

    const startET = toZonedTime(startsAt, 'America/New_York')
    const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)
    const subtotalCents = calculatePriceCents(startET.getHours(), startET.getMinutes(), durationMinutes, startET.getDay())
    const memberHours = await getActiveMembershipHourQuote({
      userId: hold.userId,
      startsAt,
      endsAt,
      subtotalCents,
      db: tx as unknown as typeof txDb,
    })
    const taxableCents = Math.max(0, subtotalCents - memberHours.discountCents)
    const taxCents = Math.round(taxableCents * CT_SALES_TAX)
    const totalCents = taxableCents + taxCents

    if (params.totalCents !== totalCents) return { error: 'payment_mismatch' as const }

    await tx.insert(bookings).values({
      id: bookingId,
      locationId: hold.locationId,
      bayId: null,
      userId: hold.userId,
      type: memberHours.appliedMinutes > 0 ? 'member' : params.type,
      startsAt,
      endsAt,
      partySize: hold.partySize,
      status: 'confirmed',
      totalCents,
      paidAt: new Date(),
    })
    await insertMembershipHourDebit({
      db: tx as unknown as typeof txDb,
      userId: hold.userId,
      bookingId,
      quote: memberHours,
    })
    if (params.paymentIntentId && totalCents > 0) {
      await tx.insert(payments).values({
        id: paymentId,
        userId: hold.userId,
        bookingId,
        amountCents: totalCents,
        processor: 'stripe',
        processorRef: params.paymentIntentId,
        type: 'charge',
        status: 'succeeded',
        idempotencyKey: `booking-${params.paymentIntentId}`,
        description: `Bay booking ${bookingId}`,
      })
    }
    await tx
      .update(bookingHolds)
      .set({ status: 'consumed' })
      .where(eq(bookingHolds.id, hold.id))
    await tx.insert(auditLog).values({
      id: nanoid(),
      actorType: 'user',
      actorId: hold.userId,
      action: 'booking.created',
      targetType: 'booking',
      targetId: bookingId,
      payloadJson: {
        startsAt: startsAt.toISOString(),
        subtotalCents,
        membershipDiscountCents: memberHours.discountCents,
        membershipMinutesApplied: memberHours.appliedMinutes,
        totalCents,
        paymentIntentId: params.paymentIntentId,
      },
      at: new Date(),
    })

    // Cache clear after commit, but we're still in tx — defer via process.nextTick.
    queueMicrotask(() => { void clearAvailabilityCacheForRange(startsAt, endsAt) })
    return {
      bookingId,
      partySize: hold.partySize,
      userId: hold.userId,
      locationId: hold.locationId,
    }
  })

  if (!('error' in result)) {
    await inngest.send({
      name: 'booking/created',
      data: { bookingId: result.bookingId, userId: result.userId, locationId: result.locationId },
    }).catch(console.error)
    return { bookingId: result.bookingId, partySize: result.partySize }
  }

  return result
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const result = await txDb.transaction(async (tx) => {
    const rows = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
    const b = rows[0]
    if (!b) return null
    const cancelledAt = new Date()
    await tx
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt, cancellationReason: reason ?? null })
      .where(eq(bookings.id, bookingId))
    const membershipRefund = await refundEligibleMembershipHours({
      db: tx as unknown as typeof txDb,
      bookingId,
      cancelledAt,
    })
    return {
      startsAt: new Date(b.startsAt as unknown as string),
      endsAt: new Date(b.endsAt as unknown as string),
      membershipRefund,
    }
  })
  if (result) await clearAvailabilityCacheForRange(result.startsAt, result.endsAt)
  return result
}

export async function cancelHold(holdId: string) {
  const result = await txDb.transaction(async (tx) => {
    const rows = await tx.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).limit(1)
    const h = rows[0]
    if (!h) return null
    await tx
      .update(bookingHolds)
      .set({ status: 'cancelled' })
      .where(eq(bookingHolds.id, holdId))
    return {
      startsAt: new Date(h.startsAt as unknown as string),
      endsAt: new Date(h.endsAt as unknown as string),
    }
  })
  if (result) await clearAvailabilityCacheForRange(result.startsAt, result.endsAt)
  return result
}

// Used by Inngest sweep or on-demand checks; idempotent.
export async function expireStaleHolds() {
  const now = new Date()
  await txDb
    .update(bookingHolds)
    .set({ status: 'expired' })
    .where(and(eq(bookingHolds.status, 'active'), lt(bookingHolds.expiresAt, now)))
}

export { facilityDateKey, dateLockKey as __dateLockKey }
