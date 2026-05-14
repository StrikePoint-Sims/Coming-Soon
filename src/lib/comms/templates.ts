import { env } from '@/env'
import { formatInTimeZone } from 'date-fns-tz'

const APP_URL = env.NEXT_PUBLIC_APP_URL
const FACILITY_TZ = 'America/New_York'

function fmtDate(iso: string) {
  return formatInTimeZone(new Date(iso), FACILITY_TZ, 'EEEE, MMMM d')
}
function fmtTime(iso: string) {
  return formatInTimeZone(new Date(iso), FACILITY_TZ, 'h:mm a')
}

// ── Booking confirmation ───────────────────────────────────────────────────────

export function bookingConfirmationEmail(params: {
  firstName: string
  bookingId: string
  bayLabel: string
  startsAt: string
  endsAt: string
}) {
  const { firstName, bookingId, bayLabel, startsAt, endsAt } = params
  return {
    subject: `Booking confirmed — ${fmtDate(startsAt)}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0a0a0a;color:#fff">
        <img src="${APP_URL}/logo.png" alt="StrikePoint Sims" height="36" style="margin-bottom:28px">
        <h2 style="color:#D4AF37;margin:0 0 8px;font-size:20px">You're booked, ${firstName}.</h2>
        <p style="color:rgba(255,255,255,0.7);margin:0 0 24px">Here are your session details:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:13px">Bay</td><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right">${bayLabel}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:13px">Date</td><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right">${fmtDate(startsAt)}</td></tr>
          <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);font-size:13px">Time</td><td style="padding:10px 0;text-align:right">${fmtTime(startsAt)} – ${fmtTime(endsAt)}</td></tr>
        </table>
        <p style="color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 24px;line-height:1.7">
          You'll receive your access code by SMS 1 hour before your session. If you need to cancel, please do so at least 24 hours in advance for a full refund.
        </p>
        <a href="${APP_URL}/book/${bookingId}" style="display:inline-block;padding:12px 24px;background:#1B4332;color:#D4AF37;border:1px solid #D4AF37;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px">View booking →</a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:32px">
          StrikePoint Sims · Colchester, CT<br>
          <a href="${APP_URL}/privacy-policy.html" style="color:rgba(255,255,255,0.3)">Privacy Policy</a>
        </p>
      </div>
    `,
  }
}

export function bookingConfirmationSms(params: {
  bayLabel: string
  startsAt: string
  endsAt: string
  bookingId: string
}) {
  const { bayLabel, startsAt, endsAt, bookingId } = params
  return `StrikePoint Sims: Booked! ${bayLabel} on ${fmtDate(startsAt)}, ${fmtTime(startsAt)}–${fmtTime(endsAt)}. Access code sent 1hr before. View: ${APP_URL}/book/${bookingId}`
}

// ── T-1h reminder ─────────────────────────────────────────────────────────────

export function bookingReminderSms(params: {
  bayLabel: string
  startsAt: string
  code: string
}) {
  const { bayLabel, startsAt, code } = params
  return `StrikePoint Sims: Your session at ${bayLabel} starts at ${fmtTime(startsAt)}. Access code: ${code}. Show this at the door. Reply STOP to opt out.`
}
