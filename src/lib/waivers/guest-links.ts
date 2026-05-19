import crypto from 'crypto'
import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import { db } from '@/db'
import { bookingGuests } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface GuestWaiverLinkParams {
  guestId: string
  guestName?: string | null
  guestEmail?: string | null
  guestPhone?: string | null
  hostName?: string | null
  sessionLabel: string
}

export function hashGuestToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateGuestToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function sendGuestWaiverLink({
  guestId,
  guestName,
  guestEmail,
  guestPhone,
  hostName,
  sessionLabel,
}: GuestWaiverLinkParams): Promise<{ email: boolean; sms: boolean }> {
  // Issue a fresh random token and persist its hash. The token itself goes
  // in the URL; the database never sees the raw value.
  const token = generateGuestToken()
  await db
    .update(bookingGuests)
    .set({ accessTokenHash: hashGuestToken(token) })
    .where(eq(bookingGuests.id, guestId))

  const waiverUrl = `${env.NEXT_PUBLIC_APP_URL}/waiver/${token}`
  const host = hostName ?? 'Your host'
  const name = guestName ?? 'there'
  let email = false
  let sms = false

  if (guestEmail) {
    await brevo.sendEmail({
      to: [{ email: guestEmail, name: guestName ?? undefined }],
      subject: `Sign your StrikePoint Sims waiver before ${sessionLabel}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <img src="${env.NEXT_PUBLIC_APP_URL}/logohorizontal.png" alt="StrikePoint Sims" height="52" style="margin-bottom:28px">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111">Waiver required</h2>
          <p style="color:#555;margin:0 0 16px;line-height:1.6">
            Hi ${escapeHtml(name)}, ${escapeHtml(host)} added you to a StrikePoint Sims session on <strong>${escapeHtml(sessionLabel)}</strong>.
          </p>
          <p style="color:#555;margin:0 0 24px;line-height:1.6">
            Every visitor needs a waiver on file before entering a bay. It takes about 2 minutes.
          </p>
          <a href="${waiverUrl}" style="display:inline-block;background:#1B4332;color:#A97845;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
            Sign waiver now
          </a>
          <p style="margin:28px 0 0;font-size:12px;color:#999">
            This link is personal to you.
          </p>
        </div>
      `,
      textContent: `Sign your StrikePoint Sims waiver for ${sessionLabel}: ${waiverUrl}`,
      tags: ['guest-waiver-link'],
    })
    email = true
  }

  if (guestPhone) {
    await brevo.sendSms({
      to: guestPhone,
      content: `StrikePoint Sims: ${host} added you to ${sessionLabel}. Sign your waiver before arrival: ${waiverUrl}`,
      tag: 'guest-waiver-link',
    })
    sms = true
  }

  return { email, sms }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
