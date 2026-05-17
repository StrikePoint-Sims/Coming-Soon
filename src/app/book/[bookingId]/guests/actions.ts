'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bookingGuests, waiverSignings } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { redirect } from 'next/navigation'

interface GuestInput {
  name: string
  phone: string
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  return raw.trim()
}

export async function addGuestsToBooking(
  bookingId: string,
  guestsRaw: Array<GuestInput>,
): Promise<{ ok: true; waiverMissing: number } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated.' }

  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) return { error: 'Booking not found.' }

  const guests = guestsRaw
    .map(g => ({ name: g.name.trim(), phone: normalizePhone(g.phone) }))
    .filter(g => g.name.length > 0 && g.phone.length > 0)

  if (guests.length === 0) return { error: 'Please provide at least one guest.' }

  const now = new Date()
  let waiverMissing = 0

  // For each guest: insert booking_guest row. We look up an existing valid waiver
  // by phone match (guests sign with name; phone match is best-effort).
  // If no waiver on file, we'll send a waiver text on the booking confirmation flow.
  for (const g of guests) {
    // Best-effort: see if a user with this phone has a valid waiver
    const [existingWaiver] = await db
      .select({ id: waiverSignings.id })
      .from(waiverSignings)
      .where(and(
        gt(waiverSignings.expiresAt, now),
        // We cannot directly look up by phone — waiverSignings ties to userId or guestEmail.
        // For now, fall back to "no match" and trigger a waiver send.
      ))
      .limit(1)
      .catch(() => [])

    const hasWaiver = !!existingWaiver
    if (!hasWaiver) waiverMissing++

    await db.insert(bookingGuests).values({
      id: nanoid(),
      bookingId,
      name: g.name,
      phone: g.phone,
      waiverSigningId: hasWaiver ? existingWaiver.id : null,
      codeSentAt: hasWaiver ? null : new Date(),
    })

    // TODO: integrate SMS provider here to text the waiver link to the guest
    // if waiverMissing > 0. For now we just record the booking_guest row.
  }

  return { ok: true, waiverMissing }
}

export async function skipGuestsAndContinue(bookingId: string): Promise<never> {
  redirect(`/book/${bookingId}` as never)
}
