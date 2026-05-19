import { inngest } from '@/lib/inngest/client'
import { db } from '@/db'
import { bookingGuests, waiverSignings, bookings, users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import crypto from 'crypto'

export const guestWaiverReminder = inngest.createFunction(
  { id: 'guest-waiver-reminder', name: 'Send 24h waiver reminder to unsigned guests' },
  { event: 'waiver/guest-reminder' },
  async ({ event }) => {
    const { guestEmail, guestPhone, tokenHash, bookingId } = event.data

    // Check if already signed — don't send reminder if waiver is complete
    const [signed] = await db
      .select({ id: waiverSignings.id })
      .from(waiverSignings)
      .where(
        and(
          eq(waiverSignings.tokenHash, tokenHash),
          gt(waiverSignings.expiresAt, new Date()),
        ),
      )
      .limit(1)

    if (signed) return { skipped: true, reason: 'waiver already signed' }

    // Look up the guest record to get the token (id)
    const [guest] = await db
      .select()
      .from(bookingGuests)
      .where(eq(bookingGuests.bookingId, bookingId))
      .limit(1)

    if (!guest) return { skipped: true, reason: 'guest not found' }

    // Look up booking for context
    const [booking] = await db
      .select({ startsAt: bookings.startsAt, userId: bookings.userId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    const [booker] = booking
      ? await db.select({ name: users.name }).from(users).where(eq(users.id, booking.userId)).limit(1)
      : []

    const waiverUrl = `${env.NEXT_PUBLIC_APP_URL}/waiver/${guest.id}`
    const bookerName = booker?.name ?? 'Your host'
    const sessionDate = booking?.startsAt
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(booking.startsAt)
      : 'your upcoming session'

    // Email reminder
    if (guestEmail) {
      await brevo.sendEmail({
        to: [{ email: guestEmail }],
        subject: `Reminder: Sign your StrikePoint Sims waiver before ${sessionDate}`,
        htmlContent: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <img src="${env.NEXT_PUBLIC_APP_URL}/logo.png" alt="StrikePoint Sims" height="52" style="margin-bottom:28px">
            <h2 style="margin:0 0 12px;font-size:20px;color:#111">Waiver reminder</h2>
            <p style="color:#555;margin:0 0 16px;line-height:1.6">
              ${bookerName} has invited you to a session at StrikePoint Sims on <strong>${sessionDate}</strong>.
            </p>
            <p style="color:#555;margin:0 0 24px;line-height:1.6">
              All participants must sign a waiver before entering a bay. It takes about 2 minutes.
              <strong>Your access code won't be sent until your waiver is on file.</strong>
            </p>
            <a href="${waiverUrl}" style="display:inline-block;background:#1B4332;color:#A97845;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
              Sign waiver now →
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#999">
              This link is personal to you. Questions? Reply to this email.
            </p>
          </div>
        `,
        tags: ['guest-waiver-reminder'],
      })
    }

    // SMS reminder if phone provided
    if (guestPhone) {
      await brevo.sendSms({
        to: guestPhone,
        content: `StrikePoint Sims: Sign your waiver before ${sessionDate} or you won't be able to enter. Sign here: ${waiverUrl}`,
        tag: 'guest-waiver-reminder',
      })
    }

    return { sent: true, email: !!guestEmail, sms: !!guestPhone }
  },
)
