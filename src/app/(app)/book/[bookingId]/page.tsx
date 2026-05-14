import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { bookings, bays } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Booking confirmed — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

export default async function BookingConfirmedPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [booking] = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      bayLabel: bays.label,
    })
    .from(bookings)
    .innerJoin(bays, eq(bookings.bayId, bays.id))
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, session.user.id)))
    .limit(1)

  if (!booking) redirect('/account')

  const fmtDate = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'EEEE, MMMM d, yyyy')
  const fmtTime = (d: Date) => formatInTimeZone(d, FACILITY_TZ, 'h:mm a')

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '48px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(27,67,50,0.6)', border: '1px solid rgba(212,175,55,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>
            ✓
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.875rem', fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>
            You&apos;re booked.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>
            A confirmation has been sent to your email.
          </p>
        </div>

        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            {[
              ['Booking ID', bookingId.slice(0, 8).toUpperCase()],
              ['Bay', booking.bayLabel],
              ['Date', fmtDate(booking.startsAt)],
              ['Time', `${fmtTime(booking.startsAt)} – ${fmtTime(booking.endsAt)}`],
              ['Status', booking.status.charAt(0).toUpperCase() + booking.status.slice(1)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>{label}</td>
                <td style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', color: '#fff', fontSize: '0.9rem' }}>{value}</td>
              </tr>
            ))}
          </table>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
          Your access code will be sent by SMS 1 hour before your session.
        </p>

        <a
          href="/account"
          style={{ display: 'block', textAlign: 'center', padding: '14px', background: '#1B4332', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none' }}
        >
          Back to account
        </a>
      </div>
    </main>
  )
}
