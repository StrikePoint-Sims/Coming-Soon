'use server'

import { db } from '@/db'
import { waitlistSignups } from '@/db/schema/auth'
import { auditLog } from '@/db/schema'
import { stripe } from '@/lib/stripe/client'
import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import { nanoid } from '@/lib/utils'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const BREVO_FOUNDERS_LIST_ID = 3 // Update with your actual Brevo list ID

const joinSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/)
    .optional()
    .or(z.literal('')),
  interestedTier: z.enum(['bronze', 'silver', 'gold', 'undecided']),
  marketingConsent: z.coerce.boolean(),
  smsConsent: z.coerce.boolean(),
  setupIntentId: z.string().startsWith('seti_').optional().or(z.literal('')),
  stripeCustomerId: z.string().startsWith('cus_').optional().or(z.literal('')),
  utmSource: z.string().max(80).optional(),
  utmMedium: z.string().max(80).optional(),
  utmCampaign: z.string().max(80).optional(),
})

export async function submitFounderApplication(formData: FormData) {
  const parsed = joinSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName') ?? '',
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    interestedTier: formData.get('interestedTier'),
    marketingConsent: formData.get('marketingConsent') === 'on',
    smsConsent: formData.get('smsConsent') === 'on',
    setupIntentId: formData.get('setupIntentId') ?? '',
    stripeCustomerId: formData.get('stripeCustomerId') ?? '',
    utmSource: formData.get('utmSource') ?? '',
    utmMedium: formData.get('utmMedium') ?? '',
    utmCampaign: formData.get('utmCampaign') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Please check your information.' }
  }

  const d = parsed.data

  // Reuse the Stripe customer created during SetupIntent creation; update metadata now that we have full details
  let stripeCustomerId: string | undefined = d.stripeCustomerId || undefined
  if (d.setupIntentId) {
    try {
      if (stripeCustomerId) {
        await stripe.customers.update(stripeCustomerId, {
          name: [d.firstName, d.lastName].filter(Boolean).join(' '),
          phone: d.phone || undefined,
          metadata: { source: 'founder_signup', tier: d.interestedTier },
        })
      } else {
        // Fallback: create customer if none was passed (e.g. page reload between steps)
        const customer = await stripe.customers.create({
          email: d.email,
          name: [d.firstName, d.lastName].filter(Boolean).join(' '),
          phone: d.phone || undefined,
          metadata: { source: 'founder_signup', tier: d.interestedTier },
        })
        stripeCustomerId = customer.id
      }
    } catch {
      // Non-fatal — save signup anyway, flag for follow-up
      console.error('Stripe customer update failed for', d.email)
    }
  }

  // Upsert into waitlist
  await db
    .insert(waitlistSignups)
    .values({
      id: nanoid(),
      email: d.email,
      firstName: d.firstName,
      lastName: d.lastName || null,
      phone: d.phone || null,
      interestedTier: d.interestedTier,
      marketingConsent: d.marketingConsent,
      smsConsent: d.smsConsent,
      stripeSetupIntentId: d.setupIntentId || null,
      stripeCustomerId: stripeCustomerId ?? null,
      utmSource: d.utmSource || null,
      utmMedium: d.utmMedium || null,
      utmCampaign: d.utmCampaign || null,
    })
    .onConflictDoUpdate({
      target: waitlistSignups.email,
      set: {
        firstName: d.firstName,
        interestedTier: d.interestedTier,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSetupIntentId: d.setupIntentId || undefined,
      },
    })

  // Sync to Brevo, then mark synced in DB
  await brevo.upsertContact({
    email: d.email,
    attributes: {
      FIRSTNAME: d.firstName,
      LASTNAME: d.lastName ?? '',
      SMS: d.phone ?? '',
      INTERESTED_TIER: d.interestedTier,
    },
    listIds: [BREVO_FOUNDERS_LIST_ID],
    updateEnabled: true,
  })
    .then(() =>
      db
        .update(waitlistSignups)
        .set({ brevoContactSynced: true })
        .where(eq(waitlistSignups.email, d.email)),
    )
    .catch(console.error)

  // Send confirmation email
  await brevo.sendEmail({
    to: [{ email: d.email, name: d.firstName }],
    subject: "You're on the list — StrikePoint Sims Founding Member",
    htmlContent: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff">
        <img src="${env.NEXT_PUBLIC_APP_URL}/logo.png" alt="StrikePoint Sims" height="36" style="margin-bottom:28px">
        <h2 style="color:#D4AF37;margin:0 0 16px;font-size:22px">You're in, ${d.firstName}.</h2>
        <p style="color:rgba(255,255,255,0.75);margin:0 0 16px;line-height:1.7">
          Your founding spot is reserved. When we open in Fall 2026, you'll hear from us first — and your founding pricing is locked for life.
        </p>
        <p style="color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 24px;line-height:1.6">
          Your card has been saved on file and will be charged only when we open. You can cancel at any time before that by replying to this email.
        </p>
        <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
          StrikePoint Sims · Colchester, CT<br>
          <a href="${env.NEXT_PUBLIC_APP_URL}/privacy-policy.html" style="color:rgba(255,255,255,0.4)">Privacy Policy</a>
        </p>
      </div>
    `,
    tags: ['founder-confirmation'],
  }).catch(console.error)

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: d.email,
    action: 'waitlist.signup',
    targetType: 'waitlist_signup',
    targetId: d.email,
    payloadJson: { tier: d.interestedTier, source: d.utmSource },
    at: new Date(),
  })

  redirect('/join/confirmed')
}

// Called by the client to create a Stripe SetupIntent before card entry
export async function createSetupIntent(email: string) {
  const customer = await stripe.customers.create({ email })
  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    usage: 'off_session',
    metadata: { source: 'founder_signup' },
  })
  return {
    clientSecret: setupIntent.client_secret!,
    customerId: customer.id,
  }
}
