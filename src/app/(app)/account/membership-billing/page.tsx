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

  const [[membership], recentPayments] = await Promise.all([
    db
      .select({
        id: memberships.id,
        status: memberships.status,
        currentPeriodEnd: memberships.currentPeriodEnd,
        startedAt: memberships.startedAt,
        isAnnual: memberships.isAnnual,
        tierName: membershipTiers.name,
        monthlyPriceCents: membershipTiers.monthlyPriceCents,
        annualPriceCents: membershipTiers.annualPriceCents,
      })
      .from(memberships)
      .innerJoin(membershipTiers, eq(memberships.tierId, membershipTiers.id))
      .where(and(
        eq(memberships.userId, user.id),
        gt(memberships.currentPeriodEnd, now),
      ))
      .limit(1),

    db
      .select({
        id: payments.id,
        amountCents: payments.amountCents,
        status: payments.status,
        description: payments.description,
        createdAt: payments.createdAt,
        type: payments.type,
      })
      .from(payments)
      .where(eq(payments.userId, user.id))
      .orderBy(desc(payments.createdAt))
      .limit(10),
  ])

  const periodPrice = membership
    ? (membership.isAnnual ? membership.annualPriceCents : membership.monthlyPriceCents) / 100
    : 0

  return (
    <div className="dash-page dash-page-v2 dash-subpage">
      <div className="dash-header">
        <h1 className="dash-title">Membership &amp; Billing</h1>
        <p className="dash-subtitle">Your plan, payment method, and recent charges.</p>
      </div>

      <div className="mb2-grid">

        {/* ── Left: Membership + Charges ──────────────────────────────── */}
        <div className="mb2-main">

          {/* Membership Status */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">CURRENT MEMBERSHIP</span>
              {membership && <span className="dash-pill active">Active</span>}
            </div>

            {membership ? (
              <>
                <div className="mb2-tier-row">
                  <div className="mb2-tier-icon">
                    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 22l3-14 4 10 3-7 3 7 4-10 3 14z"/>
                      <path d="M4 25h20"/>
                    </svg>
                  </div>
                  <div>
                    <p className="mb2-tier-name">{membership.tierName}</p>
                    <p className="mb2-tier-sub">
                      Member since {formatInTimeZone(membership.startedAt, FACILITY_TZ, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="mb2-tier-price">
                    <span className="mb2-price-amount">${periodPrice.toFixed(0)}</span>
                    <span className="mb2-price-period">/{membership.isAnnual ? 'yr' : 'mo'}</span>
                  </div>
                </div>

                <div className="mb2-renewal">
                  <span className="mb2-renewal-label">Next billing date</span>
                  <span className="mb2-renewal-date">
                    {formatInTimeZone(membership.currentPeriodEnd, FACILITY_TZ, 'EEE, MMM d, yyyy')}
                  </span>
                </div>

                <div className="st-action-row" style={{ marginTop: 16 }}>
                  <a href="/memberships" className="dash-btn ghost">Change Plan</a>
                  <a href="mailto:operations@strikepointsims.com?subject=Membership%20Cancel" className="dash-btn danger">
                    Cancel Membership
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="mb2-tier-row">
                  <div className="mb2-tier-icon">
                    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 26s9-4.5 9-11V5l-9-3-9 3v10c0 6.5 9 11 9 11z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="mb2-tier-name">Not a Member</p>
                    <p className="mb2-tier-sub">
                      Unlock unlimited off-peak access, peak hours, and priority booking.
                    </p>
                  </div>
                </div>
                <a href="/memberships" className="dash-btn primary dash-btn-full" style={{ marginTop: 16 }}>
                  View Membership Plans
                </a>
              </>
            )}
          </div>

          {/* Recent Charges */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">RECENT CHARGES</span>
              {recentPayments.length > 0 && (
                <span className="dash-section-link" style={{ cursor: 'default' }}>
                  Last {recentPayments.length}
                </span>
              )}
            </div>

            {recentPayments.length === 0 ? (
              <p className="dash-empty-line">No charges yet.</p>
            ) : (
              <div className="mb2-charge-list">
                {recentPayments.map(p => (
                  <div key={p.id} className="mb2-charge">
                    <div className="mb2-charge-icon">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <rect x="2" y="5" width="16" height="11" rx="2"/>
                        <path d="M2 9h16"/>
                      </svg>
                    </div>
                    <div className="mb2-charge-info">
                      <p className="mb2-charge-desc">{p.description ?? 'Bay Reservation'}</p>
                      <p className="mb2-charge-date">
                        {formatInTimeZone(p.createdAt, FACILITY_TZ, 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={`mb2-charge-amount ${p.type === 'refund' ? 'refund' : ''}`}>
                      {p.type === 'refund' ? '−' : ''}${(p.amountCents / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <a href="mailto:operations@strikepointsims.com?subject=Billing%20Question" className="mb2-question-link">
              Questions about a charge? Contact us.
            </a>
          </div>
        </div>

        {/* ── Right: Payment Method ───────────────────────────────────── */}
        <aside className="mb2-aside">
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">PAYMENT METHOD</span>
            </div>

            <div className="mb2-payment-empty">
              <div className="mb2-payment-icon">
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <rect x="3" y="8" width="26" height="18" rx="3"/>
                  <path d="M3 14h26"/>
                  <path d="M8 21h4M16 21h6"/>
                </svg>
              </div>
              <p className="mb2-payment-title">No card on file</p>
              <p className="mb2-payment-body">
                A payment method is saved automatically when you complete a booking or join a membership.
              </p>
            </div>
          </div>

          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">BILLING SUPPORT</span>
            </div>
            <p className="st-info-body">
              For invoices, refund requests, or payment changes — we&apos;ll respond within one business day.
            </p>
            <a href="mailto:operations@strikepointsims.com" className="dash-btn ghost dash-btn-full">
              Contact Billing
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
