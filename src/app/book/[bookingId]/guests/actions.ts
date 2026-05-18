'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, bookings, bookingGuests } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendGuestWaiverLink } from '@/lib/waivers/guest-links'
import { users } from '@/db/schema'
import { formatInTimeZone } from 'date-fns-tz'

interface GuestInput {
  name: string
  phone: string
  email?: string
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
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      userName: users.name,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(and(
      eq(bookings.id, bookingId),
      eq(bookings.userId, session.user.id),
      gt(bookings.startsAt, new Date()),
    ))
    .limit(1)

  if (!booking) return { error: 'Booking not found.' }

  const guests = guestsRaw
    .map(g => ({ name: g.name.trim(), phone: normalizePhone(g.phone), email: g.email?.trim().toLowerCase() || null }))
    .filter(g => g.name.length > 0 && (g.phone.length > 0 || g.email))

  if (guests.length === 0) return { error: 'Please provide at least one guest.' }

  const existingGuests = await db
    .select({ id: bookingGuests.id })
    .from(bookingGuests)
    .where(eq(bookingGuests.bookingId, bookingId))

  const openGuestSlots = Math.max(0, 3 - existingGuests.length)
  if (openGuestSlots === 0) return { error: 'This bay already has the maximum guest count.' }
  if (guests.length > openGuestSlots) {
    return { error: `You can add ${openGuestSlots} more guest${openGuestSlots === 1 ? '' : 's'} to this booking.` }
  }

  const sessionLabel = formatInTimeZone(booking.startsAt, 'America/New_York', 'EEE, MMM d, h:mm a')
  let linksSent = 0

  for (const g of guests) {
    const guestId = nanoid()
    await db.insert(bookingGuests).values({
      id: guestId,
      bookingId,
      name: g.name,
      phone: g.phone,
      email: g.email,
      waiverSigningId: null,
    })

    if (g.phone || g.email) {
      await sendGuestWaiverLink({
        guestId,
        guestName: g.name,
        guestEmail: g.email,
        guestPhone: g.phone,
        hostName: booking.userName,
        sessionLabel,
      })
      linksSent += 1
    }
  }

  const newPartySize = Math.min(4, 1 + existingGuests.length + guests.length)
  await db
    .update(bookings)
    .set({ partySize: newPartySize, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'booking.guests.added',
    targetType: 'booking',
    targetId: bookingId,
    payloadJson: { addedGuests: guests.length, waiverLinksSent: linksSent, partySize: newPartySize },
    at: new Date(),
  })

  revalidatePath('/account/guests')
  revalidatePath(`/account/bookings/${bookingId}`)
  return { ok: true, waiverMissing: guests.length }
}

export async function skipGuestsAndContinue(bookingId: string): Promise<never> {
  redirect(`/book/${bookingId}` as never)
}
