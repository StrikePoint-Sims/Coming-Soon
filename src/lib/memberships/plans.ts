export type MembershipPlanId = 'practice' | 'standard' | 'elite'
export type MembershipBilling = 'monthly' | 'annual'

export interface MembershipPlanConfig {
  id: MembershipPlanId
  name: string
  monthlyPriceCents: number
  annualPriceCents: number
  sessionMinutes: number
  maxConcurrentBookings: number
  advanceWindowDays: number
  guestAllowance: number
  sortOrder: number
  summary: string
  includedPeakHours: number
}

export const MEMBERSHIP_PLANS: Record<MembershipPlanId, MembershipPlanConfig> = {
  practice: {
    id: 'practice',
    name: 'Practice',
    monthlyPriceCents: 14900,
    annualPriceCents: 149000,
    sessionMinutes: 0,
    maxConcurrentBookings: 1,
    advanceWindowDays: 7,
    guestAllowance: 3,
    sortOrder: 1,
    summary: 'Unlimited off-peak access for steady weekday reps',
    includedPeakHours: 0,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    monthlyPriceCents: 27900,
    annualPriceCents: 279000,
    sessionMinutes: 8 * 60,
    maxConcurrentBookings: 1,
    advanceWindowDays: 10,
    guestAllowance: 3,
    sortOrder: 2,
    summary: 'The best fit for regular play with peak access',
    includedPeakHours: 8,
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    monthlyPriceCents: 41900,
    annualPriceCents: 419000,
    sessionMinutes: 16 * 60,
    maxConcurrentBookings: 2,
    advanceWindowDays: 14,
    guestAllowance: 3,
    sortOrder: 3,
    summary: 'More prime-time access for frequent players',
    includedPeakHours: 16,
  },
}

export function parsePlanId(raw?: string | null): MembershipPlanId {
  const value = raw?.toLowerCase()
  if (value === 'practice' || value === 'standard' || value === 'elite') return value
  return 'standard'
}

export function parseBilling(raw?: string | null): MembershipBilling {
  return raw === 'annual' ? 'annual' : 'monthly'
}

export function membershipAmountCents(plan: MembershipPlanConfig, billing: MembershipBilling): number {
  return billing === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents
}
