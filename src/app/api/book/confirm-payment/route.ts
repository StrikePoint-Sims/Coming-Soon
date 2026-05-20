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

  let body: { holdId?: string; paymentIntentId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  if (!body.holdId || !body.paymentIntentId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const pi = await stripe.paymentIntents.retrieve(body.paymentIntentId)
  if (pi.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment not yet confirmed. Please wait a moment and try again.' }, { status: 409 })
  }
  if (pi.metadata?.holdId !== body.holdId || pi.metadata?.userId !== session.user.id) {
    return NextResponse.json({ error: 'Payment does not match this booking hold.' }, { status: 403 })
  }

  const result = await confirmHoldAsBooking({
    holdId: body.holdId,
    type: (pi.metadata?.bookingType ?? 'walk_in') as 'member' | 'walk_in',
    totalCents: pi.amount,
    paymentIntentId: pi.id,
  })

  if (!('error' in result)) {
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (result.error === 'hold_missing' || result.error === 'hold_not_active') {
    const [existingPayment] = await db
      .select({ bookingId: payments.bookingId })
      .from(payments)
      .where(eq(payments.processorRef, pi.id))
      .limit(1)
    if (existingPayment?.bookingId) {
      return NextResponse.json({ bookingId: existingPayment.bookingId, partySize: 1 }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
  }

  return NextResponse.json({ error: result.error }, { status: 409 })
}
