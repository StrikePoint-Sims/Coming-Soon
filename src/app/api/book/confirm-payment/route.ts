import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { payments } from '@/db/schema'
import { confirmHoldAsBooking } from '@/lib/booking/createHold'
import { stripe } from '@/lib/stripe/client'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { holdId?: string; paymentIntentId?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  if (!body.holdId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  let paymentIntentId: string | undefined
  let paidTotalCents = 0
  let bookingType: 'member' | 'walk_in' = 'member'

  if (body.paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(body.paymentIntentId)
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not yet confirmed. Please wait a moment and try again.' }, { status: 409 })
    }
    if (pi.metadata?.holdId !== body.holdId || pi.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Payment does not match this booking hold.' }, { status: 403 })
    }
    paymentIntentId = pi.id
    paidTotalCents = pi.amount
    bookingType = (pi.metadata?.bookingType ?? 'walk_in') as 'member' | 'walk_in'
  }

  const result = await confirmHoldAsBooking({
    holdId: body.holdId,
    type: bookingType,
    totalCents: paidTotalCents,
    paymentIntentId,
  })

  if (!('error' in result)) {
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (result.error === 'hold_missing' || result.error === 'hold_not_active') {
    if (!paymentIntentId) return NextResponse.json({ error: result.error }, { status: 409 })
    const [existingPayment] = await db
      .select({ bookingId: payments.bookingId })
      .from(payments)
      .where(eq(payments.processorRef, paymentIntentId))
      .limit(1)
    if (existingPayment?.bookingId) {
      return NextResponse.json({ bookingId: existingPayment.bookingId, partySize: 1 }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }

  const message = result.error === 'payment_mismatch'
    ? 'Booking total changed while confirming. Please return to checkout and try again.'
    : result.error
  return NextResponse.json({ error: message }, { status: 409 })
}
