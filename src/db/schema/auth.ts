import { pgTable, text, integer, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './index'

// ── Auth.js v5 Drizzle adapter tables ─────────────────────────────────────────

export const authAccounts = pgTable(
  'auth_accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
)

export const authSessions = pgTable('auth_sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const authVerificationTokens = pgTable(
  'auth_verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

// ── SMS OTP ───────────────────────────────────────────────────────────────────

export const otpCodes = pgTable('otp_codes', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Waitlist / founding member signups ────────────────────────────────────────

export const waitlistSignups = pgTable('waitlist_signups', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  phone: text('phone'),
  interestedTier: text('interested_tier'),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  smsConsent: boolean('sms_consent').notNull().default(false),
  stripeSetupIntentId: text('stripe_setup_intent_id'),
  stripeCustomerId: text('stripe_customer_id'),
  source: text('source').notNull().default('web'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  brevoContactSynced: boolean('brevo_contact_synced').notNull().default(false),
  // Survey data captured incrementally per slide
  golfLevel: text('golf_level'),
  community: text('community'),
  priority: text('priority'),
  // Funnel tracking
  status: text('status').notNull().default('started'), // started | completed
  founderPath: boolean('founder_path').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
