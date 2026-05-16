/**
 * Hourly rate pricing based on time of day (Eastern Time).
 * Night:    midnight – 7 am    $30/hr
 * Off-peak: 7 am – noon, 8 pm – midnight  $45/hr
 * Peak:     noon – 8 pm        $60/hr
 */

const NIGHT_RATE_CENTS = 3000   // per hour
const OFF_PEAK_RATE_CENTS = 4500
const PEAK_RATE_CENTS = 6000

export const CT_SALES_TAX = 0.0635  // 6.35%

function getTierForHour(hour: number): 'night' | 'offpeak' | 'peak' {
  if (hour < 7) return 'night'
  if (hour < 12) return 'offpeak'
  if (hour < 20) return 'peak'
  return 'offpeak'
}

function rateForHour(hour: number): number {
  const tier = getTierForHour(hour)
  if (tier === 'night') return NIGHT_RATE_CENTS
  if (tier === 'peak') return PEAK_RATE_CENTS
  return OFF_PEAK_RATE_CENTS
}

/**
 * Calculate the price in cents for a slot starting at `startHour` (ET)
 * and lasting `durationMinutes`.
 * Uses the rate for the starting hour across the whole duration.
 */
export function calculatePriceCents(startHourET: number, durationMinutes: number): number {
  const rate = rateForHour(startHourET)
  return Math.round((rate * durationMinutes) / 60)
}

export function formatPrice(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}
