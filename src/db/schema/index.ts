import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ── Shared helpers ────────────────────────────────────────────────────────────

const id = () => text('id').primaryKey()
const locationId = () => text('location_id').notNull().references(() => locations.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

// ── Enums ─────────────────────────────────────────────────────────────────────

export const bayStatusEnum = pgEnum('bay_status', ['active', 'maintenance', 'disabled'])

export const membershipStatusEnum = pgEnum('membership_status', [
  'prospect', 'trial', 'active', 'at_risk', 'frozen', 'cancelled', 'reactivated',
])

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show',
])

export const bookingTypeEnum = pgEnum('booking_type', [
  'member', 'walk_in', 'day_pass', 'trial', 'corporate', 'league', 'lesson',
])

export const paymentTypeEnum = pgEnum('payment_type', [
  'charge', 'refund', 'credit', 'gift_card_redemption',
])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded',
])

export const paymentProcessorEnum = pgEnum('payment_processor', ['stripe'])

export const accessCodeStatusEnum = pgEnum('access_code_status', [
  'pending', 'active', 'expired', 'revoked',
])

export const giftCardStatusEnum = pgEnum('gift_card_status', [
  'active', 'exhausted', 'cancelled',
])

export const referralCreditStatusEnum = pgEnum('referral_credit_status', [
  'pending', 'issued', 'expired',
])

export const promoDiscountTypeEnum = pgEnum('promo_discount_type', [
  'percent', 'fixed_cents',
])

export const leagueStatusEnum = pgEnum('league_status', [
  'draft', 'open', 'in_progress', 'completed', 'cancelled',
])

export const corporateEventStatusEnum = pgEnum('corporate_event_status', [
  'inquiry', 'quoted', 'deposit_paid', 'confirmed', 'completed', 'cancelled',
])

export const supportThreadStatusEnum = pgEnum('support_thread_status', [
  'open', 'escalated', 'resolved',
])

export const supportMessageDirectionEnum = pgEnum('support_message_direction', [
  'inbound', 'outbound',
])

export const channelEnum = pgEnum('channel', ['email', 'sms', 'chat'])

export const auditActorTypeEnum = pgEnum('audit_actor_type', [
  'user', 'admin', 'system', 'ai_agent',
])

export const incidentSeverityEnum = pgEnum('incident_severity', [
  'low', 'medium', 'high', 'critical',
])

export const adminRoleEnum = pgEnum('admin_role', ['owner', 'manager', 'staff'])

// ── Tables ────────────────────────────────────────────────────────────────────

export const locations = pgTable('locations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address').notNull(),
  timezone: text('timezone').notNull().default('America/New_York'),
  hoursConfigJson: jsonb('hours_config_json').notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const bays = pgTable('bays', {
  id: id(),
  locationId: locationId(),
  label: text('label').notNull(),
  status: bayStatusEnum('status').notNull().default('active'),
  trackmanBayId: text('trackman_bay_id'),
  openpathDoorId: text('openpath_door_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  // Required by Auth.js Drizzle adapter
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  phone: text('phone').unique(),
  name: text('name'),
  handedness: text('handedness'),
  marketingEmailConsent: boolean('marketing_email_consent').notNull().default(false),
  smsConsent: boolean('sms_consent').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id').unique(),
  trackmanUserId: text('trackman_user_id').unique(),
  referralCode: text('referral_code').unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const adminUsers = pgTable('admin_users', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: adminRoleEnum('role').notNull().default('staff'),
  permissionsJson: jsonb('permissions_json').notNull().default({}),
  createdAt: createdAt(),
})

export const waivers = pgTable('waivers', {
  id: id(),
  version: integer('version').notNull().unique(),
  contentMd: text('content_md').notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const waiverSignings = pgTable('waiver_signings', {
  id: id(),
  userId: text('user_id').references(() => users.id),
  guestEmail: text('guest_email'),
  waiverId: text('waiver_id').notNull().references(() => waivers.id),
  signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
  ip: text('ip').notNull(),
  userAgent: text('user_agent'),
  signatureText: text('signature_text').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  tokenHash: text('token_hash').unique(),
  createdAt: createdAt(),
})

export const membershipTiers = pgTable('membership_tiers', {
  id: id(),
  locationId: locationId(),
  name: text('name').notNull(),
  monthlyPriceCents: integer('monthly_price_cents').notNull(),
  annualPriceCents: integer('annual_price_cents').notNull(),
  sessionMinutes: integer('session_minutes').notNull(),
  maxConcurrentBookings: integer('max_concurrent_bookings').notNull().default(1),
  advanceWindowDays: integer('advance_window_days').notNull().default(14),
  guestAllowance: integer('guest_allowance').notNull().default(0),
  accessHoursRuleJson: jsonb('access_hours_rule_json').notNull().default({}),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const memberships = pgTable('memberships', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationId: locationId(),
  tierId: text('tier_id').notNull().references(() => membershipTiers.id, { onDelete: 'restrict' }),
  status: membershipStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  freezeUntil: timestamp('freeze_until', { withTimezone: true }),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  isAnnual: boolean('is_annual').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const bookings = pgTable('bookings', {
  id: id(),
  locationId: locationId(),
  bayId: text('bay_id').notNull().references(() => bays.id),
  userId: text('user_id').notNull().references(() => users.id),
  type: bookingTypeEnum('type').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  partySize: integer('party_size').notNull().default(1),
  status: bookingStatusEnum('status').notNull().default('confirmed'),
  source: text('source').notNull().default('web'),
  totalCents: integer('total_cents').notNull().default(0),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  refundCents: integer('refund_cents').notNull().default(0),
  recurringSeriesId: text('recurring_series_id'),
  isRecurring: boolean('is_recurring').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const bookingGuests = pgTable('booking_guests', {
  id: id(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  waiverSigningId: text('waiver_signing_id').references(() => waiverSignings.id),
  codeSentAt: timestamp('code_sent_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const accessCodes = pgTable('access_codes', {
  id: id(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  code: text('code').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
  status: accessCodeStatusEnum('status').notNull().default('pending'),
  openpathCredentialId: text('openpath_credential_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const payments = pgTable('payments', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id),
  bookingId: text('booking_id').references(() => bookings.id),
  membershipId: text('membership_id').references(() => memberships.id),
  amountCents: integer('amount_cents').notNull(),
  processor: paymentProcessorEnum('processor').notNull(),
  processorRef: text('processor_ref').unique(),
  type: paymentTypeEnum('type').notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  refundedAmountCents: integer('refunded_amount_cents').notNull().default(0),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const giftCards = pgTable('gift_cards', {
  id: id(),
  code: text('code').notNull().unique(),
  initialValueCents: integer('initial_value_cents').notNull(),
  currentBalanceCents: integer('current_balance_cents').notNull(),
  purchaserUserId: text('purchaser_user_id').references(() => users.id),
  recipientEmail: text('recipient_email'),
  recipientPhone: text('recipient_phone'),
  recipientName: text('recipient_name'),
  status: giftCardStatusEnum('status').notNull().default('active'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const giftCardUses = pgTable('gift_card_uses', {
  id: id(),
  giftCardId: text('gift_card_id').notNull().references(() => giftCards.id),
  paymentId: text('payment_id').notNull().references(() => payments.id),
  amountCents: integer('amount_cents').notNull(),
  createdAt: createdAt(),
})

export const referralCodes = pgTable('referral_codes', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id),
  code: text('code').notNull().unique(),
  usesCount: integer('uses_count').notNull().default(0),
  createdAt: createdAt(),
})

export const referralCredits = pgTable('referral_credits', {
  id: id(),
  referrerUserId: text('referrer_user_id').notNull().references(() => users.id),
  referredUserId: text('referred_user_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  status: referralCreditStatusEnum('status').notNull().default('pending'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const promoCodes = pgTable('promo_codes', {
  id: id(),
  locationId: locationId(),
  code: text('code').notNull().unique(),
  discountType: promoDiscountTypeEnum('discount_type').notNull(),
  discountValue: integer('discount_value').notNull(),
  eligibilityJson: jsonb('eligibility_json').notNull().default({}),
  usesRemaining: integer('uses_remaining'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  singleUsePerCustomer: boolean('single_use_per_customer').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const credits = pgTable('credits', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id),
  balanceCents: integer('balance_cents').notNull(),
  source: text('source').notNull(),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  issuedByAi: boolean('issued_by_ai').notNull().default(false),
  createdAt: createdAt(),
})

export const pricingRules = pgTable('pricing_rules', {
  id: id(),
  locationId: locationId(),
  ruleType: text('rule_type').notNull(),
  conditionsJson: jsonb('conditions_json').notNull().default({}),
  valueJson: jsonb('value_json').notNull().default({}),
  priority: integer('priority').notNull().default(0),
  active: boolean('active').notNull().default(true),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const leagues = pgTable('leagues', {
  id: id(),
  locationId: locationId(),
  name: text('name').notNull(),
  format: text('format').notNull(),
  entryFeeCents: integer('entry_fee_cents').notNull().default(0),
  seasonStart: timestamp('season_start', { withTimezone: true }).notNull(),
  seasonEnd: timestamp('season_end', { withTimezone: true }).notNull(),
  fieldSizeMax: integer('field_size_max'),
  eligibilityJson: jsonb('eligibility_json').notNull().default({}),
  prizePoolRuleJson: jsonb('prize_pool_rule_json').notNull().default({}),
  status: leagueStatusEnum('status').notNull().default('draft'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const leagueEntries = pgTable('league_entries', {
  id: id(),
  leagueId: text('league_id').notNull().references(() => leagues.id),
  userId: text('user_id').notNull().references(() => users.id),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  currentScore: integer('current_score'),
  position: integer('position'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const corporateEvents = pgTable('corporate_events', {
  id: id(),
  locationId: locationId(),
  organizerUserId: text('organizer_user_id').notNull().references(() => users.id),
  packageName: text('package_name').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  bayIdsJson: jsonb('bay_ids_json').notNull().default([]),
  status: corporateEventStatusEnum('status').notNull().default('inquiry'),
  depositAmountCents: integer('deposit_amount_cents').notNull().default(0),
  depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
  balanceDueAt: timestamp('balance_due_at', { withTimezone: true }),
  balancePaidAt: timestamp('balance_paid_at', { withTimezone: true }),
  guestListJson: jsonb('guest_list_json').notNull().default([]),
  stripeDepositPaymentIntentId: text('stripe_deposit_payment_intent_id'),
  stripeBalanceInvoiceId: text('stripe_balance_invoice_id'),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const supportThreads = pgTable('support_threads', {
  id: id(),
  userId: text('user_id').references(() => users.id),
  channel: channelEnum('channel').notNull(),
  status: supportThreadStatusEnum('status').notNull().default('open'),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  ownerRepliedAt: timestamp('owner_replied_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const supportMessages = pgTable('support_messages', {
  id: id(),
  threadId: text('thread_id').notNull().references(() => supportThreads.id),
  direction: supportMessageDirectionEnum('direction').notNull(),
  channel: channelEnum('channel').notNull(),
  body: text('body').notNull(),
  aiConfidence: integer('ai_confidence'),
  toolCallsJson: jsonb('tool_calls_json').default([]),
  createdAt: createdAt(),
})

export const communications = pgTable('communications', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id),
  templateKey: text('template_key').notNull(),
  channel: channelEnum('channel').notNull(),
  status: text('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const auditLog = pgTable('audit_log', {
  id: id(),
  actorType: auditActorTypeEnum('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  payloadJson: jsonb('payload_json').default({}),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
})

export const incidents = pgTable('incidents', {
  id: id(),
  type: text('type').notNull(),
  severity: incidentSeverityEnum('severity').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  affectedBookingIdsJson: jsonb('affected_booking_ids_json').default([]),
  detailsJson: jsonb('details_json').default({}),
  createdAt: createdAt(),
})

export const maintenanceTasks = pgTable('maintenance_tasks', {
  id: id(),
  locationId: locationId(),
  type: text('type').notNull(),
  cadence: text('cadence').notNull(),
  lastDoneAt: timestamp('last_done_at', { withTimezone: true }),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const inventoryItems = pgTable('inventory_items', {
  id: id(),
  locationId: locationId(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  currentStock: integer('current_stock').notNull().default(0),
  reorderThreshold: integer('reorder_threshold').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// Per-booking shot data synced from Trackman Connect API (available at soft-open)
export const sessionStats = pgTable('session_stats', {
  id: id(),
  bookingId: text('booking_id').notNull().references(() => bookings.id).unique(),
  userId: text('user_id').notNull().references(() => users.id),
  trackmanSessionId: text('trackman_session_id'),
  totalShots: integer('total_shots').notNull().default(0),
  longestDriveYards: integer('longest_drive_yards'),
  avgCarryYards: integer('avg_carry_yards'),
  avgBallSpeedMph: integer('avg_ball_speed_mph'),
  avgClubSpeedMph: integer('avg_club_speed_mph'),
  rawDataJson: jsonb('raw_data_json').default({}),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})
