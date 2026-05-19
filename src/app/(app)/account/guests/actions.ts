'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, bookingGuests, bookings, users, waiverSignings } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { sendGuestWaiverLink } from '@/lib/waivers/guest-links'
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const FACILITY_TZ = 'America/New_York'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  return raw.trim()
}

function guestsRedirect(params: Record<string, string | number>): never {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) search.set(key, String(value))
  redirect(`/account/guests?${search.toString()}` as never)
}

export async function addAccountGuest(formData: FormData): Promise<never> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const bookingId = formData.get('bookingId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const phone = normalizePhone(formData.get('phone')?.toString() ?? '')
  const email = formData.get('email')?.toString().trim().toLowerCase() || null

  if (!bookingId || !name || (!phone && !email)) {
    guestsRedirect({ error: 'missing' })
  }

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      partySize: bookings.partySize,
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

  if (!booking) guestsRedirect({ error: 'booking' })

  const existingGuests = await db
    .select({ id: bookingGuests.id })
    .from(bookingGuests)
    .where(eq(bookingGuests.bookingId, booking.id))

  if (existingGuests.length >= 3) guestsRedirect({ error: 'capacity' })

  const guestId = nanoid()
  await db.insert(bookingGuests).values({
    id: guestId,
    bookingId: booking.id,
    name,
    phone,
    email,
    waiverSigningId: null,
  })

  const sessionLabel = formatInTimeZone(booking.startsAt, FACILITY_TZ, 'EEE, MMM d, h:mm a')
  await sendGuestWaiverLink({
    guestId,
    guestName: name,
    guestEmail: email,
    guestPhone: phone,
    hostName: booking.userName,
    sessionLabel,
  })

  const newPartySize = Math.min(4, 1 + existingGuests.length + 1)
  await db
    .update(bookings)
    .set({ partySize: newPartySize, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id))

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'account.guest.added',
    targetType: 'booking_guest',
    targetId: guestId,
    payloadJson: { bookingId: booking.id, waiverLinkSent: true, partySize: newPartySize },
    at: new Date(),
  })

  revalidatePath('/account/guests')
  revalidatePath('/account')
  revalidatePath(`/account/bookings/${booking.id}`)
  guestsRedirect({ added: 1 })
}

export async function sendGuestWaiverLinkAction(formData: FormData): Promise<never> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const guestId = formData.get('guestId')?.toString()
  if (!guestId) guestsRedirect({ error: 'guest' })

  const guest = await getOwnedUnsignedGuest(session.user.id, guestId)
  if (!guest) guestsRedirect({ error: 'guest' })

  await sendGuestWaiverLink({
    guestId: guest.id,
    guestName: guest.name,
    guestEmail: guest.email,
    guestPhone: guest.phone,
    hostName: guest.userName,
    sessionLabel: formatInTimeZone(guest.startsAt, FACILITY_TZ, 'EEE, MMM d, h:mm a'),
  })

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'account.guest.waiver_link_sent',
    targetType: 'booking_guest',
    targetId: guest.id,
    payloadJson: { bookingId: guest.bookingId },
    at: new Date(),
  })

  revalidatePath('/account/guests')
  guestsRedirect({ sent: 1 })
}

export async function sendAllGuestWaiverLinks(): Promise<never> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const guests = await db
    .select({
      id: bookingGuests.id,
      bookingId: bookingGuests.bookingId,
      name: bookingGuests.name,
      email: bookingGuests.email,
      phone: bookingGuests.phone,
      startsAt: bookings.startsAt,
      userName: users.name,
    })
    .from(bookingGuests)
    .innerJoin(bookings, eq(bookingGuests.bookingId, bookings.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .leftJoin(waiverSignings, eq(bookingGuests.waiverSigningId, waiverSignings.id))
    .where(and(
      eq(bookings.userId, session.user.id),
      gt(bookings.startsAt, new Date()),
      or(isNull(bookingGuests.waiverSigningId), lt(waiverSignings.expiresAt, new Date())),
    ))

  let sent = 0
  for (const guest of guests) {
    if (!guest.email && !guest.phone) continue
    await sendGuestWaiverLink({
      guestId: guest.id,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      hostName: guest.userName,
      sessionLabel: formatInTimeZone(guest.startsAt, FACILITY_TZ, 'EEE, MMM d, h:mm a'),
    })
    sent += 1
  }

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'account.guest.waiver_links_sent_all',
    targetType: 'user',
    targetId: session.user.id,
    payloadJson: { sent },
    at: new Date(),
  })

  revalidatePath('/account/guests')
  guestsRedirect({ sent })
}

async function getOwnedUnsignedGuest(userId: string, guestId: string) {
  const [guest] = await db
    .select({
      id: bookingGuests.id,
      bookingId: bookingGuests.bookingId,
      name: bookingGuests.name,
      email: bookingGuests.email,
      phone: bookingGuests.phone,
      startsAt: bookings.startsAt,
      userName: users.name,
    })
    .from(bookingGuests)
    .innerJoin(bookings, eq(bookingGuests.bookingId, bookings.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .leftJoin(waiverSignings, eq(bookingGuests.waiverSigningId, waiverSignings.id))
    .where(and(
      eq(bookingGuests.id, guestId),
      eq(bookings.userId, userId),
      or(isNull(bookingGuests.waiverSigningId), lt(waiverSignings.expiresAt, new Date())),
    ))
    .limit(1)

  return guest ?? null
}
