'use server'

import { db } from '@/db'
import { waiverSignings, waivers, bookingGuests, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { WAIVER_VERSION } from '@/lib/waivers/content'
import { hashGuestToken } from '@/lib/waivers/guest-links'

const WAIVER_VALIDITY_MONTHS = 12

export async function signGuestWaiver(formData: FormData) {
  const token = formData.get('token')?.toString()
  const signatureText = formData.get('signatureText')?.toString().trim()
  const agreed = formData.get('agreed') === 'on'

  if (!token || !signatureText || signatureText.length < 2 || !agreed) {
    throw new Error('Please complete all fields and check the agreement box.')
  }

  // Token is a random opaque string; we look the guest up by its hash and
  // never accept the row's primary key as a fallback.
  const tokenHash = hashGuestToken(token)

  const [existingSigning] = await db
    .select()
    .from(waiverSignings)
    .where(eq(waiverSignings.tokenHash, tokenHash))
    .limit(1)

  if (existingSigning?.signedAt) {
    // Already signed — redirect to confirmation
    redirect(`/waiver/${token}/confirmed`)
  }

  const [guest] = await db
    .select()
    .from(bookingGuests)
    .where(eq(bookingGuests.accessTokenHash, tokenHash))
    .limit(1)

  if (!guest) {
    throw new Error('This waiver link is invalid or has expired. Please ask the booking host to resend it.')
  }

  // Get current waiver id
  const [waiver] = await db
    .select({ id: waivers.id })
    .from(waivers)
    .where(eq(waivers.version, WAIVER_VERSION))
    .limit(1)

  if (!waiver) throw new Error('Waiver not found. Please contact us.')

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = headersList.get('user-agent') ?? ''

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + WAIVER_VALIDITY_MONTHS)

  const signingId = nanoid()
  await db.insert(waiverSignings).values({
    id: signingId,
    userId: null,
    guestEmail: guest.email,
    waiverId: waiver.id,
    signedAt: new Date(),
    ip,
    userAgent,
    signatureText,
    expiresAt,
    tokenHash,
  })

  // Link the signing back to the booking guest row
  await db
    .update(bookingGuests)
    .set({ waiverSigningId: signingId })
    .where(eq(bookingGuests.id, guest.id))

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: guest.email ?? 'guest',
    action: 'waiver.signed.guest',
    targetType: 'booking_guest',
    targetId: guest.id,
    payloadJson: { bookingId: guest.bookingId, ip, expiresAt: expiresAt.toISOString() },
    at: new Date(),
  })

  redirect(`/waiver/${token}/confirmed`)
}
