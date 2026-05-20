import { and, eq, gt, gte, inArray, lt, sql } from 'drizzle-orm'
import { toZonedTime } from 'date-fns-tz'
import { db } from '@/db'
import { bookings, membershipHourLedger, memberships, membershipTiers } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { calculateCoveredMinutesValueCents } from './pricing'

const FACILITY_TZ = 'America/New_York'
const REFUND_CUTOFF_MS = 12 * 60 * 60_000
const ACTIVE_MEMBERSHIP_STATUSES: Array<'active' | 'reactivated' | 'trial'> = ['active', 'reactivated', 'trial']

// Drizzle's HTTP client and transaction client have compatible query methods
// but different concrete types.
type DbLike = any

export interface MembershipHourQuote {
  membershipId: string | null
  includedMinutes: number
  usedMinutes: number
  remainingMinutes: number
  appliedMinutes: number
  discountCents: number
}

export interface BookingPricingQuote extends MembershipHourQuote {
  subtotalCents: number
  taxableCents: number
  taxCents: number
  totalCents: number
}

export function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000))
}

export async function getActiveMembershipHourQuote(params: {
  userId: string
  startsAt: Date
  endsAt: Date
  subtotalCents: number
  db?: DbLike
}): Promise<MembershipHourQuote> {
  const store = params.db ?? db
  const now = new Date()
  const [membership] = await store
    .select({
      id: memberships.id,
      startedAt: memberships.startedAt,
      currentPeriodEnd: memberships.currentPeriodEnd,
      includedMinutes: membershipTiers.sessionMinutes,
    })
    .from(memberships)
    .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
    .where(and(
      eq(memberships.userId, params.userId),
      inArray(memberships.status, ACTIVE_MEMBERSHIP_STATUSES),
      gt(memberships.currentPeriodEnd, now),
    ))
    .limit(1)

  if (!membership || membership.includedMinutes <= 0) {
    return {
      membershipId: null,
      includedMinutes: 0,
      usedMinutes: 0,
      remainingMinutes: 0,
      appliedMinutes: 0,
      discountCents: 0,
    }
  }

  const [usage] = await store
    .select({
      usedMinutes: sql<number>`coalesce(sum(case when ${membershipHourLedger.kind} = 'debit' then ${membershipHourLedger.minutes} when ${membershipHourLedger.kind} = 'refund' then -${membershipHourLedger.minutes} else 0 end), 0)`,
    })
    .from(membershipHourLedger)
    .where(and(
      eq(membershipHourLedger.membershipId, membership.id),
      gte(membershipHourLedger.createdAt, membership.startedAt),
      lt(membershipHourLedger.createdAt, membership.currentPeriodEnd),
    ))

  const usedMinutes = Number(usage?.usedMinutes ?? 0)
  const remainingMinutes = Math.max(0, membership.includedMinutes - usedMinutes)
  const appliedMinutes = Math.min(remainingMinutes, durationMinutes(params.startsAt, params.endsAt))
  const startET = toZonedTime(params.startsAt, FACILITY_TZ)
  const discountCents = Math.min(
    params.subtotalCents,
    calculateCoveredMinutesValueCents(
      startET.getHours(),
      startET.getMinutes(),
      durationMinutes(params.startsAt, params.endsAt),
      appliedMinutes,
      startET.getDay(),
    ),
  )

  return {
    membershipId: membership.id,
    includedMinutes: membership.includedMinutes,
    usedMinutes,
    remainingMinutes,
    appliedMinutes,
    discountCents,
  }
}

export async function insertMembershipHourDebit(params: {
  db: DbLike
  userId: string
  bookingId: string
  quote: MembershipHourQuote
}) {
  if (!params.quote.membershipId || params.quote.appliedMinutes <= 0) return
  await params.db.insert(membershipHourLedger).values({
    id: nanoid(),
    userId: params.userId,
    membershipId: params.quote.membershipId,
    bookingId: params.bookingId,
    kind: 'debit',
    minutes: params.quote.appliedMinutes,
    amountCents: params.quote.discountCents,
  })
}

export async function refundEligibleMembershipHours(params: {
  db: DbLike
  bookingId: string
  cancelledAt: Date
}): Promise<{ refundedMinutes: number; refundedAmountCents: number }> {
  const store = params.db
  const [booking] = await store
    .select({ startsAt: bookings.startsAt })
    .from(bookings)
    .where(eq(bookings.id, params.bookingId))
    .limit(1)
  if (!booking || booking.startsAt.getTime() - params.cancelledAt.getTime() <= REFUND_CUTOFF_MS) {
    return { refundedMinutes: 0, refundedAmountCents: 0 }
  }

  const [existingRefund] = await store
    .select({ id: membershipHourLedger.id })
    .from(membershipHourLedger)
    .where(and(eq(membershipHourLedger.bookingId, params.bookingId), eq(membershipHourLedger.kind, 'refund')))
    .limit(1)
  if (existingRefund) return { refundedMinutes: 0, refundedAmountCents: 0 }

  const [debit] = await store
    .select({
      userId: membershipHourLedger.userId,
      membershipId: membershipHourLedger.membershipId,
      minutes: membershipHourLedger.minutes,
      amountCents: membershipHourLedger.amountCents,
    })
    .from(membershipHourLedger)
    .where(and(eq(membershipHourLedger.bookingId, params.bookingId), eq(membershipHourLedger.kind, 'debit')))
    .limit(1)

  if (!debit) return { refundedMinutes: 0, refundedAmountCents: 0 }

  await store.insert(membershipHourLedger).values({
    id: nanoid(),
    userId: debit.userId,
    membershipId: debit.membershipId,
    bookingId: params.bookingId,
    kind: 'refund',
    minutes: debit.minutes,
    amountCents: debit.amountCents,
  })

  return { refundedMinutes: debit.minutes, refundedAmountCents: debit.amountCents }
}
