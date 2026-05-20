import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookingHolds } from '@/db/schema'
import { getActiveMembershipHourQuote } from '@/lib/booking/membership-hours'
import { calculatePriceCents, CT_SALES_TAX } from '@/lib/booking/pricing'
import { stripe } from '@/lib/stripe/client'
import { and, eq, gt } from 'drizzle-orm'
import { toZonedTime } from 'date-fns-tz'

export const runtime = 'nodejs'

const FACILITY_TZ = 'America/New_York'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { holdId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  if (!body.holdId) return NextResponse.json({ error: 'Missing holdId' }, { status: 400 })

  const [hold] = await db
    .select()
    .from(bookingHolds)
    .where(and(
      eq(bookingHolds.id, body.holdId),
      eq(bookingHolds.userId, session.user.id),
      eq(bookingHolds.status, 'active'),
      gt(bookingHolds.expiresAt, new Date()),
    ))
    .limit(1)

  if (!hold) return NextResponse.json({ error: 'Hold expired or not found. Please select a new time.' }, { status: 404 })

  const startET = toZonedTime(hold.startsAt, FACILITY_TZ)
  const durationMinutes = Math.round((hold.endsAt.getTime() - hold.startsAt.getTime()) / 60_000)
  const subtotalCents = calculatePriceCents(startET.getHours(), startET.getMinutes(), durationMinutes, startET.getDay())
  const memberHours = await getActiveMembershipHourQuote({
    userId: session.user.id,
    startsAt: hold.startsAt,
    endsAt: hold.endsAt,
    subtotalCents,
  })
  const taxableCents = Math.max(0, subtotalCents - memberHours.discountCents)
  const taxCents = Math.round(taxableCents * CT_SALES_TAX)
  const totalCents = taxableCents + taxCents

  if (totalCents === 0) {
    return NextResponse.json({
      clientSecret: null,
      requiresPayment: false,
      subtotalCents,
      membershipDiscountCents: memberHours.discountCents,
      membershipMinutesApplied: memberHours.appliedMinutes,
      membershipMinutesRemainingBefore: memberHours.remainingMinutes,
      taxableCents,
      taxCents,
      totalCents,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const pi = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: {
      holdId: hold.id,
      userId: session.user.id,
      bookingType: memberHours.appliedMinutes > 0 ? 'member' : 'walk_in',
      membershipDiscountCents: String(memberHours.discountCents),
      membershipMinutesApplied: String(memberHours.appliedMinutes),
      startsAt: hold.startsAt.toISOString(),
      endsAt: hold.endsAt.toISOString(),
    },
  })

  if (!pi.client_secret) return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })

  return NextResponse.json({
    clientSecret: pi.client_secret,
    requiresPayment: true,
    subtotalCents,
    membershipDiscountCents: memberHours.discountCents,
    membershipMinutesApplied: memberHours.appliedMinutes,
    membershipMinutesRemainingBefore: memberHours.remainingMinutes,
    taxableCents,
    taxCents,
    totalCents,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
