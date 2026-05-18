import { getCurrentUser } from '@/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import '../account.css'

export const metadata: Metadata = {
  title: 'Guests & Waivers — StrikePoint Sims',
  robots: { index: false },
}

// Mock guests until backend is wired up. Replace with real data source.
const MOCK_GUESTS: Array<{
  id: string
  name: string
  email: string
  status: 'signed' | 'pending' | 'expired'
  date: string
}> = []

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return (first + (parts.length > 1 ? last : '')).toUpperCase()
}

export default async function GuestsWaiversPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const guests = MOCK_GUESTS

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">Guests &amp; Waivers</h1>
        <p className="dash-subtitle">
          Add and manage guests for your bookings. Waivers are required annually for all visitors.
        </p>
      </div>

      <div className="gw-layout">
        <div className="gw-main">
          {/* Info banner */}
          <div className="gw-banner">
            <div className="gw-banner-icon">
              <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 21s7-3.5 7-9V4.5L11 2 4 4.5V11c0 5.5 7 9 7 9z"/>
                <path d="M8 11l2.5 2.5L15 9"/>
              </svg>
            </div>
            <div>
              <p className="gw-banner-title">Waivers are handled automatically.</p>
              <p className="gw-banner-body">Add a guest by name and phone — we&apos;ll check if their waiver is on file and text them a link if not.</p>
            </div>
          </div>

          {/* Guests card */}
          <div className="dash-section-card">
            <div className="dash-section-header">
              <span className="dash-section-label gold">YOUR GUESTS</span>
              <div className="gw-header-actions">
                <button type="button" className="dash-btn primary gw-btn-sm">+ Add Guest</button>
                <button type="button" className="dash-btn ghost gw-btn-sm">Send Waiver Link to All</button>
              </div>
            </div>

            {guests.length === 0 ? (
              <div className="dash-empty-block">
                <p className="dash-empty-heading">No guests added yet</p>
                <p className="dash-empty-body">
                  Add a guest by name and phone — anytime, including when you book.
                </p>
                <button type="button" className="dash-btn primary dash-btn-full">
                  Add Your First Guest
                </button>
              </div>
            ) : (
              <div className="gw-list">
                {guests.map(g => (
                  <div key={g.id} className="gw-row">
                    <div className="gw-avatar">{initials(g.name)}</div>
                    <div className="gw-info">
                      <p className="gw-name">{g.name}</p>
                      <p className="gw-email">{g.email}</p>
                    </div>
                    <div className="gw-status-col">
                      <span className={`gw-status ${g.status}`}>
                        <span className="gw-status-dot" />
                        {g.status === 'signed' ? 'Signed' : g.status === 'pending' ? 'Pending' : 'Expired'}
                      </span>
                      <span className="gw-status-date">{g.date}</span>
                    </div>
                    <button type="button" className="gw-row-action" aria-label="More actions">⋯</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="gw-footer-note">
            You can add guests anytime, including at booking. We&apos;ll check if their waiver is on file and text them a link if it&apos;s missing or expired. Waivers are valid for one year from the date signed.
          </p>
        </div>

        {/* Right sidebar: Guest Policy */}
        <aside className="gw-aside">
          <div className="dash-section-card gw-policy">
            <div className="gw-policy-icon">
              <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <circle cx="9" cy="9" r="3.5"/>
                <path d="M2 22a7 7 0 0114 0"/>
                <circle cx="20" cy="10" r="2.8"/>
                <path d="M16 22a5 5 0 0110 0"/>
              </svg>
            </div>
            <p className="gw-policy-title">GUEST POLICY</p>
            <p className="gw-policy-tagline">Each booking includes</p>
            <p className="gw-policy-headline">Up to 3 Guests</p>
            <p className="gw-policy-sub">Member or booking holder plus guests</p>

            <div className="gw-policy-divider" />

            <ul className="gw-policy-list">
              <li>
                <span className="gw-policy-bullet">✓</span>
                Members can bring up to 3 guests per booking.
              </li>
              <li>
                <span className="gw-policy-bullet">✓</span>
                Add a guest anytime — name and phone is all we need.
              </li>
              <li>
                <span className="gw-policy-bullet">✓</span>
                We auto-check waivers and text a link if one&apos;s missing.
              </li>
              <li>
                <span className="gw-policy-bullet">✓</span>
                Waivers are valid for one year from the date signed.
              </li>
            </ul>

            <a href="/memberships" className="dash-btn ghost dash-btn-full" style={{ marginTop: 16 }}>
              Learn More
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
