'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bookingHolds, waiverSignings, auditLog } from '@/db/schema'
import { eq, and, gt, desc, lt } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

const HOLD_TTL_MINUTES = 10

// Create a hold for a (bay, time) pair. Replaces any existing hold by this user.
export async function createHold(params: {
  locationId: string
  bayId: string
  startsAt: string
  endsAt: string
}): Promise<{ holdId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not signed in.' }

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

  await db.transaction(async (tx) => {
    await tx.insert(bookings).values({
      id: bookingId,
      locationId: hold.locationId,
      bayId: hold.bayId,
      userId,
      type: 'member',
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      status: 'confirmed',
      source: 'web',
      totalCents: 0,
    })
    await tx.delete(bookingHolds).where(eq(bookingHolds.id, holdId))
    await tx.insert(auditLog).values({
      id: nanoid(),
      actorType: 'user',
      actorId: userId,
      action: 'booking.created',
      targetType: 'booking',
      targetId: bookingId,
      payloadJson: { bayId: hold.bayId, startsAt: hold.startsAt.toISOString() },
      at: new Date(),
    })
  })

  await inngest.send({
    name: 'booking/created',
    data: { bookingId, userId, locationId: hold.locationId },
  })

  revalidatePath('/account')
  redirect(`/book/${bookingId}`)
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
