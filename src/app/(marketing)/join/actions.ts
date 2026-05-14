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

const BREVO_FOUNDERS_LIST_ID = 3

// ── Stripe: create $1 PaymentIntent for card authorization ────────────────────
// Matches the original join.html flow: authorize $1 (never captured) to verify card.

export async function createFoundingPaymentIntent(
  email: string,
  name: string,
  tier: string,
) {
  if (!stripe) {
    throw new Error('Payment system not configured.')
  }
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { source: 'founder_signup', tier },
  })
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 100, // $1.00 — authorization only, never captured
    currency: 'usd',
    customer: customer.id,
    capture_method: 'manual',
    setup_future_usage: 'off_session',
    metadata: { source: 'founder_signup', tier },
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
  return {
    clientSecret: paymentIntent.client_secret!,
    customerId: customer.id,
    paymentIntentId: paymentIntent.id,
  }
}

// ── Submit founder data after Stripe confirmation ─────────────────────────────

const founderSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional().default(''),
  email: z.string().email(),
  interestedTier: z.string().max(40).optional().default('none'),
  golfLevel: z.string().max(120).optional().default(''),
  community: z.string().max(80).optional().default(''),
  priority: z.string().max(300).optional().default(''),
  isFounder: z.boolean().optional().default(false),
})

export async function submitFounderData(input: {
  firstName: string
  lastName: string
  email: string
  interestedTier: string
  golfLevel: string
  community: string
  priority: string
  isFounder: boolean
}) {
  const parsed = founderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Please check your information.' }
  }
  const d = parsed.data

  try {
    await db
      .insert(waitlistSignups)
      .values({
        id: nanoid(),
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName || null,
        phone: null,
        interestedTier: d.interestedTier || null,
        marketingConsent: false,
        smsConsent: false,
        stripeSetupIntentId: null,
        stripeCustomerId: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
      })
      .onConflictDoUpdate({
        target: waitlistSignups.email,
        set: {
          firstName: d.firstName,
          interestedTier: d.interestedTier || undefined,
        },
      })
  } catch (err) {
    console.error('DB insert error:', err)
    // Non-fatal — still try Brevo + audit
  }

  // Sync to Brevo (non-fatal)
  await brevo
    .upsertContact({
      email: d.email,
      attributes: {
        FIRSTNAME: d.firstName,
        LASTNAME: d.lastName ?? '',
        INTERESTED_TIER: d.interestedTier ?? '',
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

  // Confirmation email (non-fatal)
  await brevo
    .sendEmail({
      to: [{ email: d.email, name: d.firstName }],
      subject: d.isFounder
        ? "You're in — StrikePoint Sims Founding Member"
        : "You're on the list — StrikePoint Sims",
      htmlContent: d.isFounder
        ? `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff">
            <img src="${env.NEXT_PUBLIC_APP_URL ?? 'https://strikepointsims.com'}/logohorizontal.png" alt="StrikePoint Sims" height="30" style="margin-bottom:28px">
            <h2 style="color:#c9a84c;margin:0 0 16px;font-size:22px">You're in, ${d.firstName}.</h2>
            <p style="color:rgba(255,255,255,0.75);margin:0 0 16px;line-height:1.7">
              Your ${d.interestedTier} Founding spot is reserved. When we open in Fall 2026,
              you'll hear from us first — and your founding pricing is locked for life.
            </p>
            <p style="color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 24px;line-height:1.6">
              Your card has been saved on file and will be charged only when we open.
              You can cancel at any time before that by replying to this email.
            </p>
            <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
              StrikePoint Sims · Colchester, CT
            </p>
          </div>
        `
        : `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff">
            <img src="${env.NEXT_PUBLIC_APP_URL ?? 'https://strikepointsims.com'}/logohorizontal.png" alt="StrikePoint Sims" height="30" style="margin-bottom:28px">
            <h2 style="color:#8fa65e;margin:0 0 16px;font-size:22px">You're on the list, ${d.firstName}.</h2>
            <p style="color:rgba(255,255,255,0.75);margin:0 0 16px;line-height:1.7">
              You'll get build updates, opening news, and a heads-up when bookings go live.
            </p>
            <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
              StrikePoint Sims · Colchester, CT
            </p>
          </div>
        `,
      tags: [d.isFounder ? 'founder-confirmation' : 'waitlist-confirmation'],
    })
    .catch(console.error)

  // Audit log (non-fatal)
  await db
    .insert(auditLog)
    .values({
      id: nanoid(),
      actorType: 'user',
      actorId: d.email,
      action: d.isFounder ? 'waitlist.founder_signup' : 'waitlist.updates_signup',
      targetType: 'waitlist_signup',
      targetId: d.email,
      payloadJson: { tier: d.interestedTier, golfLevel: d.golfLevel, community: d.community },
      at: new Date(),
    })
    .catch(console.error)

  return { success: true }
}

// ── Legacy: kept for backwards compat ────────────────────────────────────────

export async function createSetupIntent(email: string) {
  if (!stripe) throw new Error('Stripe not configured')
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

// ── Legacy: submitFounderApplication (kept in case anything still references it)

const joinSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/)
    .optional()
    .or(z.literal('')),
  interestedTier: z.string().max(40).optional(),
  marketingConsent: z.coerce.boolean(),
  smsConsent: z.coerce.boolean(),
  setupIntentId: z.string().optional().or(z.literal('')),
  stripeCustomerId: z.string().optional().or(z.literal('')),
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
    interestedTier: formData.get('interestedTier') ?? 'none',
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

  try {
    await db
      .insert(waitlistSignups)
      .values({
        id: nanoid(),
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName || null,
        phone: d.phone || null,
        interestedTier: d.interestedTier || null,
        marketingConsent: d.marketingConsent,
        smsConsent: d.smsConsent,
        stripeSetupIntentId: d.setupIntentId || null,
        stripeCustomerId: d.stripeCustomerId || null,
        utmSource: d.utmSource || null,
        utmMedium: d.utmMedium || null,
        utmCampaign: d.utmCampaign || null,
      })
      .onConflictDoUpdate({
        target: waitlistSignups.email,
        set: {
          firstName: d.firstName,
          interestedTier: d.interestedTier || undefined,
          stripeCustomerId: d.stripeCustomerId || undefined,
          stripeSetupIntentId: d.setupIntentId || undefined,
        },
      })
  } catch (err) {
    console.error('DB insert error:', err)
  }

  return { success: true }
}
