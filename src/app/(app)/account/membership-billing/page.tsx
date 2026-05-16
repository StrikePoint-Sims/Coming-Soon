import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { memberships, membershipTiers, payments } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import '../account.css'

export const metadata: Metadata = {
  title: 'Membership & Billing — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

export default async function MembershipBillingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()

  // Active membership
  const [membership] = await db
    .select({
      id: memberships.id,
      status: memberships.status,
      currentPeriodEnd: memberships.currentPeriodEnd,
      isAnnual: memberships.isAnnual,
      tierName: membershipTiers.name,
      monthlyPriceCents: membershipTiers.monthlyPriceCents,
    })
    .from(memberships)
    .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
    .where(and(
      eq(memberships.userId, user.id),
      gt(memberships.currentPeriodEnd, now),
    ))
    .limit(1)

  // Recent payments
  const recentPayments = await db
    .select({
      id: payments.id,
      amountCents: payments.amountCents,
      status: payments.status,
      description: payments.description,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.userId, user.id))
    .orderBy(desc(payments.createdAt))
    .limit(10)

  return (
    <div className="ap-page">
      <h1 className="ap-title">Membership &amp; Billing</h1>
      <p className="ap-subtitle">Manage your membership and view payment history.</p>

      {/* Membership status */}
      <div className="ap-card">
        <p className="ap-card-title">Current Membership</p>
        {membership ? (
          <>
            <div className="ap-row">
              <span className="ap-row-label">Plan</span>
              <span className="ap-row-value" style={{ color: '#D4AF37' }}>{membership.tierName}</span>
            </div>
            <div className="ap-row">
              <span className="ap-row-label">Billing</span>
              <span className="ap-row-value">{membership.isAnnual ? 'Annual' : 'Monthly'}</span>
            </div>
            <div className="ap-row">
              <span className="ap-row-label">Renews</span>
              <span className="ap-row-value">{formatInTimeZone(membership.currentPeriodEnd, FACILITY_TZ, 'MMM d, yyyy')}</span>
            </div>
            <div className="ap-row">
              <span className="ap-row-label">Status</span>
              <span className="ap-badge confirmed">{membership.status}</span>
            </div>
          </>
        ) : (
          <>
            <div className="ap-empty" style={{ padding: '20px 0 10px', textAlign: 'left' }}>
              You don't have an active membership.
            </div>
            <a href="/memberships" className="ap-btn primary" style={{ display: 'inline-flex' }}>
              View Membership Plans →
            </a>
          </>
        )}
      </div>

      {/* Payment history */}
      <div className="ap-card">
        <p className="ap-card-title">Payment History</p>
        {recentPayments.length === 0 ? (
          <div className="ap-empty">No payment history yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map(p => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.55)' }}>
                      {formatInTimeZone(p.createdAt, FACILITY_TZ, 'MMM d, yyyy')}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {p.description ?? 'Payment'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' }}>
                      ${(p.amountCents / 100).toFixed(2)}
                    </td>
                    <td>
                      <span className={`ap-badge ${p.status === 'succeeded' ? 'confirmed' : p.status === 'pending' ? 'pending' : 'cancelled'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note about payment method */}
      <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', marginTop: 8, lineHeight: 1.6 }}>
        To update your payment method or cancel your membership, contact us at{' '}
        <a href="mailto:operations@strikepointsims.com" style={{ color: 'rgba(255,255,255,0.4)' }}>
          operations@strikepointsims.com
        </a>
      </p>
    </div>
  )
}
