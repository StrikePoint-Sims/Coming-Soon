import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import type { Metadata } from 'next'
import { updateProfile, requestDataExport } from '../actions'
import '../account.css'

export const metadata: Metadata = {
  title: 'Settings — StrikePoint Sims',
  robots: { index: false },
}

const FACILITY_TZ = 'America/New_York'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const now = new Date()

  const [latestWaiver] = await db
    .select({ signedAt: waiverSignings.signedAt, expiresAt: waiverSignings.expiresAt })
    .from(waiverSignings)
    .where(and(eq(waiverSignings.userId, user.id), gt(waiverSignings.expiresAt, now)))
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  return (
    <div className="ap-page">
      <h1 className="ap-title">Settings</h1>
      <p className="ap-subtitle">Manage your profile, login methods, and preferences.</p>

      {/* Profile */}
      <div className="ap-card">
        <p className="ap-card-title">Profile</p>
        <form action={updateProfile}>
          <div className="ap-form-group">
            <label className="ap-form-label" htmlFor="s-name">Full Name</label>
            <input
              id="s-name"
              className="ap-form-input"
              name="name"
              defaultValue={user.name ?? ''}
              placeholder="Your full name"
              required
            />
          </div>
          <div className="ap-form-group">
            <label className="ap-form-label" htmlFor="s-email">Email</label>
            <input
              id="s-email"
              className="ap-form-input"
              type="email"
              value={user.email ?? ''}
              disabled
              readOnly
              style={{ opacity: 0.45, cursor: 'not-allowed' }}
            />
            <p className="ap-form-hint">Email cannot be changed. Contact support if needed.</p>
          </div>
          <div className="ap-form-group">
            <label className="ap-form-label" htmlFor="s-phone">Phone Number</label>
            <input
              id="s-phone"
              className="ap-form-input"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ''}
              placeholder="+12035550100"
            />
            <p className="ap-form-hint">Used for booking reminders and access codes. US numbers only (+1XXXXXXXXXX).</p>
          </div>
          <div className="ap-form-group">
            <label className="ap-form-label" htmlFor="s-hand">Dominant Hand</label>
            <select id="s-hand" className="ap-form-select" name="handedness" defaultValue={user.handedness ?? ''}>
              <option value="">Not specified</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="ambidextrous">Ambidextrous</option>
            </select>
          </div>

          <div className="ap-form-divider" />

          <p className="ap-card-title" style={{ marginBottom: 14 }}>Communication Preferences</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="marketingEmailConsent"
                defaultChecked={user.marketingEmailConsent}
                style={{ width: 16, height: 16, accentColor: '#D4AF37', marginTop: 2, flexShrink: 0 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>Marketing emails</span>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>News, promotions, and league announcements</span>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="smsConsent"
                defaultChecked={user.smsConsent}
                style={{ width: 16, height: 16, accentColor: '#D4AF37', marginTop: 2, flexShrink: 0 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>SMS notifications</span>
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>Booking reminders, access codes, and session alerts</span>
              </span>
            </label>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)', marginBottom: 18, lineHeight: 1.55 }}>
            Transactional messages (access codes, receipts) are always sent regardless of preferences.
          </p>
          <button type="submit" className="ap-btn primary" style={{ display: 'flex', width: '100%', height: 44 }}>
            Save Changes
          </button>
        </form>
      </div>

      {/* Waiver */}
      <div className="ap-card">
        <p className="ap-card-title">Waiver Status</p>
        {latestWaiver ? (
          <div className="ap-row">
            <span className="ap-row-label">Signed Waiver</span>
            <span className="ap-row-value" style={{ color: '#8fbc58' }}>
              ✓ Valid until {formatInTimeZone(latestWaiver.expiresAt, FACILITY_TZ, 'MMM d, yyyy')}
            </span>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginBottom: 14, lineHeight: 1.5 }}>
              No active waiver on file. A signed waiver is required before booking a bay.
            </p>
            <a href="/waiver" className="ap-btn ghost" style={{ display: 'inline-flex', height: 40 }}>
              Sign Waiver →
            </a>
          </>
        )}
      </div>

      {/* Data & privacy */}
      <div className="ap-card">
        <p className="ap-card-title">Data &amp; Privacy</p>
        <p style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.6 }}>
          You can request a copy of your data or delete your account. Deletions are processed within 30 days.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form action={requestDataExport}>
            <button type="submit" className="ap-btn ghost" style={{ height: 40, fontSize: '0.82rem' }}>
              Export My Data
            </button>
          </form>
          <a
            href="mailto:operations@strikepointsims.com?subject=Account%20Deletion%20Request"
            className="ap-btn danger"
            style={{ height: 40, fontSize: '0.82rem' }}
          >
            Delete Account
          </a>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.22)', marginTop: 12, lineHeight: 1.55 }}>
          Account deletion is handled by our team at{' '}
          <a href="mailto:operations@strikepointsims.com" style={{ color: 'rgba(255,255,255,0.38)' }}>
            operations@strikepointsims.com
          </a>
        </p>
      </div>
    </div>
  )
}
