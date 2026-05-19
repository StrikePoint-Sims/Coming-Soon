import { toZonedTime } from 'date-fns-tz'

const FACILITY_TZ = 'America/New_York'

const NIGHT_RATE_CENTS = 3000
const OFF_PEAK_RATE_CENTS = 4500
const PEAK_RATE_CENTS = 6000

function getTierForHour(hour: number, dayOfWeek: number): 'night' | 'offpeak' | 'peak' {
  if (hour >= 22 || hour < 6) return 'night'
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  if (isWeekend) return 'peak'
  return hour < 17 ? 'offpeak' : 'peak'
}

interface BookingForUsage {
  startsAt: Date
  endsAt: Date
  totalCents: number
}

export interface UsageBreakdown {
  sessions: number
  totalMinutes: number
  paidCents: number
  peakMinutes: number
  offPeakMinutes: number
  nightMinutes: number
}

export function breakdownBooking(
  startsAt: Date,
  endsAt: Date,
): { peakMinutes: number; offPeakMinutes: number; nightMinutes: number } {
  const startET = toZonedTime(startsAt, FACILITY_TZ)
  const durationMs = endsAt.getTime() - startsAt.getTime()
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000))

  let peak = 0
  let offPeak = 0
  let night = 0
  let remaining = totalMinutes
  let hour = startET.getHours()
  let minute = startET.getMinutes()
  let dow = startET.getDay()

  while (remaining > 0) {
    const segmentMinutes = Math.min(remaining, 60 - minute)
    const tier = getTierForHour(hour, dow)
    if (tier === 'peak') peak += segmentMinutes
    else if (tier === 'offpeak') offPeak += segmentMinutes
    else night += segmentMinutes

    remaining -= segmentMinutes
    minute = 0
    hour += 1
    if (hour === 24) {
      hour = 0
      dow = (dow + 1) % 7
    }
  }

  return { peakMinutes: peak, offPeakMinutes: offPeak, nightMinutes: night }
}

export function summarizeUsage(bookings: BookingForUsage[]): UsageBreakdown {
  const result: UsageBreakdown = {
    sessions: 0,
    totalMinutes: 0,
    paidCents: 0,
    peakMinutes: 0,
    offPeakMinutes: 0,
    nightMinutes: 0,
  }

  for (const b of bookings) {
    const breakdown = breakdownBooking(b.startsAt, b.endsAt)
    result.sessions += 1
    result.totalMinutes += breakdown.peakMinutes + breakdown.offPeakMinutes + breakdown.nightMinutes
    result.peakMinutes += breakdown.peakMinutes
    result.offPeakMinutes += breakdown.offPeakMinutes
    result.nightMinutes += breakdown.nightMinutes
    result.paidCents += b.totalCents
  }

  return result
}

// ── Membership tiers (mirrors /memberships page) ─────────────────────────────

export interface TierDef {
  id: 'practice' | 'standard' | 'elite'
  name: string
  monthlyCents: number
  includedPeakMinutes: number // 0 = no peak hours
}

export const TIERS: TierDef[] = [
  { id: 'practice', name: 'Practice', monthlyCents: 14900, includedPeakMinutes: 0 },
  { id: 'standard', name: 'Standard', monthlyCents: 27900, includedPeakMinutes: 8 * 60 },
  { id: 'elite',    name: 'Elite',    monthlyCents: 41900, includedPeakMinutes: 16 * 60 },
]

/**
 * Hypothetical cost of the given usage under each tier:
 * - Off-peak and night minutes are free with membership.
 * - Peak minutes are free up to includedPeakMinutes, then overage at peak rate.
 * - Plus the flat monthly fee.
 */
export function costUnderTier(usage: UsageBreakdown, tier: TierDef): number {
  const overagePeak = Math.max(0, usage.peakMinutes - tier.includedPeakMinutes)
  const overageCents = Math.round((overagePeak / 60) * PEAK_RATE_CENTS)
  return tier.monthlyCents + overageCents
}

export interface SavingsResult {
  bestTier: TierDef
  bestTierCost: number
  paidCents: number
  savingsCents: number
}

/**
 * For a non-member, find the tier with the largest savings vs. what they paid.
 * Returns null if no tier saves money.
 */
export function findBestSavings(usage: UsageBreakdown): SavingsResult | null {
  if (usage.sessions === 0) return null

  let best: SavingsResult | null = null
  for (const tier of TIERS) {
    const tierCost = costUnderTier(usage, tier)
    const savings = usage.paidCents - tierCost
    if (savings > 0 && (!best || savings > best.savingsCents)) {
      best = {
        bestTier: tier,
        bestTierCost: tierCost,
        paidCents: usage.paidCents,
        savingsCents: savings,
      }
    }
  }
  return best
}

// Unused but exported for parity if needed elsewhere
export const _RATES = { NIGHT_RATE_CENTS, OFF_PEAK_RATE_CENTS, PEAK_RATE_CENTS }
