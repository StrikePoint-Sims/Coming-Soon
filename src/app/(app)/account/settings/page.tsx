import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import { SettingsSignOut } from './SettingsSignOut'
import { SupportActions } from './SupportActions'
import '../account.css'

export const metadata: Metadata = {
  title: 'Settings — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()
  const params = await searchParams
  const defaultNotificationsOn = params.saved !== 'notifications'

  const [latestWaiver] = await db
    .select({ expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">Settings</h1>
        <p className="dash-subtitle">Manage your profile, contact info, and preferences.</p>
      </div>

      {(params.saved || params.error) && (
        <div className={`st-save-message${params.error ? ' error' : ''}`}>
          {params.error
            ? decodeURIComponent(params.error)
            : params.saved === 'notifications' ? 'Notification preferences saved.' : 'Profile saved.'}
        </div>
      )}

      <div className="st-grid">

        {/* ── Left: main settings ─────────────────────────────────────── */}
        <div className="st-main">

          {/* Profile */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">PROFILE</span>
            </div>
            <form action="/account/settings/profile" method="post">
              <div className="st-form-row">
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="s-name">Full Name</label>
                  <input
                    id="s-name"
                    className="st-form-input"
                    name="name"
                    defaultValue={user.name ?? ''}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="s-hand">Dominant Hand</label>
                  <select
                    id="s-hand"
                    className="st-form-input"
                    name="handedness"
                    defaultValue={user.handedness ?? ''}
                  >
                    <option value="">Not specified</option>
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                    <option value="ambidextrous">Ambidextrous</option>
                  </select>
                </div>
              </div>

              <div className="st-form-row">
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="s-email">Email</label>
                  <input
                    id="s-email"
                    className="st-form-input is-disabled"
                    type="email"
                    value={user.email ?? ''}
                    disabled
                    readOnly
                  />
                  <p className="st-form-hint">Contact us to change your email.</p>
                </div>
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="s-phone">Phone Number</label>
                  <input
                    id="s-phone"
                    className="st-form-input"
                    name="phone"
                    type="tel"
                    defaultValue={user.phone ?? ''}
                    placeholder="(203) 555-0100"
                  />
                  <p className="st-form-hint">Used for account verification and transactional messages.</p>
                  <p className="st-form-hint">Access codes are transactional and are always sent when required.</p>
                </div>
              </div>

              <button type="submit" className="dash-btn primary dash-btn-full">
                Save Profile
              </button>
            </form>
          </div>

          {/* Notifications */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">NOTIFICATIONS</span>
            </div>
            <form action="/account/settings/notifications" method="post">
              <input type="hidden" name="name" value={user.name ?? ''} />
              <input type="hidden" name="phone" value={user.phone ?? ''} />
              <input type="hidden" name="handedness" value={user.handedness ?? ''} />

              <label className="st-toggle">
                <span className="st-toggle-text">
                  <span className="st-toggle-label">Marketing emails</span>
                  <span className="st-toggle-sub">News, league announcements, and member offers.</span>
                </span>
                <input
                  type="checkbox"
                  name="marketingEmailConsent"
                  defaultChecked={user.marketingEmailConsent || defaultNotificationsOn}
                  className="st-toggle-checkbox"
                />
                <span className="st-toggle-switch" />
              </label>

              <label className="st-toggle">
                  <span className="st-toggle-text">
                    <span className="st-toggle-label">SMS notifications</span>
                  <span className="st-toggle-sub">Optional reminders and account updates.</span>
                  </span>
                <input
                  type="checkbox"
                  name="smsConsent"
                  defaultChecked={user.smsConsent || defaultNotificationsOn}
                  className="st-toggle-checkbox"
                />
                <span className="st-toggle-switch" />
              </label>

              <p className="st-info-note">
                Transactional messages, including access codes and receipts, are always sent regardless of preferences.
              </p>

              <button type="submit" className="dash-btn ghost dash-btn-full">
                Save Notifications
              </button>
            </form>
          </div>

          {/* Data & Privacy */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">DATA &amp; PRIVACY</span>
            </div>
            <p className="st-info-body">
              Request a copy of your data or delete your account. We process requests within 30 days.
            </p>
            <div className="st-action-row">
              <a
                href="mailto:operations@strikepointsims.com?subject=Data%20Export%20Request"
                className="dash-btn ghost"
              >
                Request Data Export
              </a>
              <a
                href="mailto:operations@strikepointsims.com?subject=Account%20Deletion%20Request"
                className="dash-btn danger"
              >
                Delete Account
              </a>
            </div>
          </div>

          <SettingsSignOut />
        </div>

        {/* ── Right: sidebar info ─────────────────────────────────────── */}
        <aside className="st-aside">

          {/* Waiver status */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">WAIVER</span>
            </div>
            {latestWaiver ? (
              <>
                <div className="st-waiver-icon valid">
                  <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 21s7-3.5 7-9V4.5L11 2 4 4.5V11c0 5.5 7 9 7 9z"/>
                    <path d="M8 11l2.5 2.5L15 9"/>
                  </svg>
                </div>
                <p className="st-waiver-status valid">Active</p>
                <p className="st-waiver-detail">
                  Valid through<br/>
                  <strong>{formatInTimeZone(latestWaiver.expiresAt, FACILITY_TZ, 'MMM d, yyyy')}</strong>
                </p>
              </>
            ) : (
              <>
                <div className="st-waiver-icon invalid">
                  <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 21s7-3.5 7-9V4.5L11 2 4 4.5V11c0 5.5 7 9 7 9z"/>
                    <path d="M11 7v5M11 15h0"/>
                  </svg>
                </div>
                <p className="st-waiver-status invalid">No active waiver</p>
                <p className="st-waiver-detail">
                  A signed waiver is required before booking a bay.
                </p>
                <a href="/waiver" className="dash-btn ghost dash-btn-full" style={{ marginTop: 14 }}>
                  Sign Waiver
                </a>
              </>
            )}
          </div>

          {/* Help */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">NEED HELP?</span>
            </div>
            <p className="st-info-body">
              Reach us anytime. Members get priority response.
            </p>
            <SupportActions
              name={user.name ?? ''}
              email={user.email ?? ''}
              phone={user.phone ?? ''}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
