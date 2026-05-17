import './memberships.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Memberships | StrikePoint Sims',
  description: 'Unlimited off-peak access, peak hours, and 24/7 bookings. Choose Practice, Standard, or Elite.',
}

const TIERS = [
  {
    name: 'Practice',
    monthlyPrice: 149,
    featured: false,
    features: [
      'Unlimited off-peak access',
      'No included peak hours',
      '7-day advance booking',
      '1 active reservation',
      'Guest privileges (4-person bay limit)',
    ],
  },
  {
    name: 'Standard',
    monthlyPrice: 279,
    featured: true,
    features: [
      '8 peak hours per month',
      'Unlimited off-peak access',
      '10-day advance booking',
      '1 active reservation',
      'Guest privileges (4-person bay limit)',
    ],
  },
  {
    name: 'Elite',
    monthlyPrice: 419,
    featured: false,
    features: [
      '16 peak hours per month',
      'Unlimited off-peak access',
      '14-day advance booking',
      '2 active reservations',
      'Guest privileges (4-person bay limit)',
    ],
  },
]

export default function MembershipsPage() {
  return (
    <div className="mem-page">
      <div className="mem-hero">
        <h1 className="mem-title">Memberships</h1>
        <p className="mem-subtitle">
          Unlimited off-peak access, peak hours, and 24/7 bookings. Pay per month or save with annual.
        </p>
      </div>

      <div className="mem-grid">
        {TIERS.map(tier => (
          <div key={tier.name} className={`mem-card${tier.featured ? ' is-featured' : ''}`}>
            {tier.featured && <span className="mem-card-badge">Most Popular</span>}

            <p className="mem-card-name">{tier.name}</p>

            <div className="mem-card-price">
              <span className="mem-card-amount">${tier.monthlyPrice}</span>
              <span className="mem-card-period">/mo</span>
            </div>

            <div className="mem-card-divider" />

            <ul className="mem-feature-list">
              {tier.features.map(f => (
                <li key={f}>
                  <span className="mem-feature-check">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <a href="/login" className={`mem-card-btn${tier.featured ? ' primary' : ' ghost'}`}>
              Get Started
            </a>
          </div>
        ))}
      </div>

      <div className="mem-hours">
        <p className="mem-hours-title">Peak &amp; Off-Peak Hours</p>
        <div className="mem-hours-grid">
          <div className="mem-hours-row">
            <span className="mem-hours-label">Off-Peak</span>
            <span className="mem-hours-desc">Weekdays 6:00 AM – 5:00 PM &amp; nightly 10:00 PM – 6:00 AM</span>
          </div>
          <div className="mem-hours-row">
            <span className="mem-hours-label">Peak</span>
            <span className="mem-hours-desc">Weekdays 5:00 PM – 10:00 PM &amp; weekends 6:00 AM – 10:00 PM</span>
          </div>
        </div>
      </div>
    </div>
  )
}
