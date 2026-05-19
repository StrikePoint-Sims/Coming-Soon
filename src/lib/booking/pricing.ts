/**
 * Hourly rate pricing based on time of day and day of week (Eastern Time).
 *
 * Night:    10:00 PM – 6:00 AM  (every day)              $30/hr
 * Off-peak: Weekdays 6:00 AM – 5:00 PM                   $45/hr
 * Peak:     Weekdays 5:00 PM – 10:00 PM                  $60/hr
 *           Weekends 6:00 AM – 10:00 PM                  $60/hr
 */

const NIGHT_RATE_CENTS    = 3000   // $30/hr
const OFF_PEAK_RATE_CENTS = 4500   // $45/hr
const PEAK_RATE_CENTS     = 6000   // $60/hr

export const CT_SALES_TAX = 0.0635  // 6.35%

function getTierForHour(hour: number, dayOfWeek: number): 'night' | 'offpeak' | 'peak' {
  // Night spans midnight: 10 PM (22) through 5:59 AM
  if (hour >= 22 || hour < 6) return 'night'

  // dayOfWeek: 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  if (isWeekend) return 'peak'           // weekends 6 AM–10 PM = peak

  return hour < 17 ? 'offpeak' : 'peak' // weekdays: before 5 PM off-peak, 5–10 PM peak
}

function rateForHour(hour: number, dayOfWeek: number): number {
  const tier = getTierForHour(hour, dayOfWeek)
  if (tier === 'night') return NIGHT_RATE_CENTS
  if (tier === 'peak')  return PEAK_RATE_CENTS
  return OFF_PEAK_RATE_CENTS
}

/**
 * Calculate the total price in cents for a booking.
 * Iterates hour-by-hour across tier boundaries so a booking spanning
 * e.g. 5:30 AM–7:00 AM is priced as 30 min night + 60 min off-peak.
 */
export function calculatePriceCents(
  startHourET: number,
  startMinuteET: number,
  durationMinutes: number,
  dayOfWeek: number,
): number {
  let totalCents = 0
  let remaining = durationMinutes
  let hour = startHourET
  let minute = startMinuteET
  let dow = dayOfWeek

  while (remaining > 0) {
    const minutesToEndOfHour = 60 - minute
    const segmentMinutes = Math.min(remaining, minutesToEndOfHour)
    totalCents += Math.round((rateForHour(hour, dow) * segmentMinutes) / 60)
    remaining -= segmentMinutes
    minute = 0
    hour += 1
    if (hour === 24) {
      hour = 0
      dow = (dow + 1) % 7
    }
  }

  return totalCents
}

export function formatPrice(cents: number): string {
  return '$' + (cents / 100).toFixed(2)
}
