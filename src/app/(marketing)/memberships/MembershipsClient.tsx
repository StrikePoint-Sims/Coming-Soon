'use client'

import { useState } from 'react'

type BillingMode = 'monthly' | 'annual'

const TIERS = [
  {
    name: 'Practice',
    pitch: (
      <>
        Steady reps and weekday practice <em>without overcommitting</em>
      </>
    ),
    monthly: '$149',
    annual: '$1,490',
    cta: 'Choose Practice',
    featured: false,
    features: [
      { strong: 'Unlimited', text: ' off-peak + night access' },
      { muted: true, text: 'No included peak hours' },
      { text: '7-day advance booking' },
      { text: '1 active reservation' },
      { text: 'Bring up to 3 guests per session' },
    ],
  },
  {
    name: 'Standard',
    pitch: (
      <>
        The best fit for most golfers <em>who want regular peak access</em>
      </>
    ),
    monthly: '$279',
    annual: '$2,790',
    cta: 'Choose Standard',
    featured: true,
    features: [
      { strong: '8 peak hours', text: ' per month' },
      { text: 'Unlimited off-peak + night access' },
      { text: '10-day advance booking' },
      { text: '1 active reservation' },
      { text: 'Bring up to 3 guests per session' },
    ],
  },
  {
    name: 'Elite',
    pitch: (
      <>
        For frequent players and league regulars <em>who want more prime time</em>
      </>
    ),
    monthly: '$419',
    annual: '$4,190',
    cta: 'Choose Elite',
    featured: false,
    features: [
      { strong: '16 peak hours', text: ' per month' },
      { text: 'Unlimited off-peak + night access' },
      { text: '14-day advance booking' },
      { strong: '2 active reservations', text: '' },
      { text: 'Bring up to 3 guests per session' },
    ],
  },
]

const COMPARE_ROWS = [
  ['Monthly', '$149', '$279', '$419'],
  ['Annual', '$1,490', '$2,790', '$4,190'],
  ['Off-peak access', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['Peak hours / month', '-', '8 hr', '16 hr'],
  ['Advance booking', '7 days', '10 days', '14 days'],
  ['Active reservations', '1', '1', '2'],
  ['Guests', 'Up to 3 / session', 'Up to 3 / session', 'Up to 3 / session'],
]

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 8.5l3.5 3.5L13.5 4.5" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 8h10" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s-8-4-8-12V5l8-3 8 3v5c0 8-8 12-8 12z" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

export function MembershipsClient() {
  const [billing, setBilling] = useState<BillingMode>('monthly')
  const period = billing === 'monthly' ? '/ mo' : '/ yr'

  return (
    <main className="mem-page">
      <section className="mem-hero">
        <div className="mem-wrap">
          <span className="mem-eyebrow">Memberships</span>
          <h1>Pick the plan that fits how you actually play</h1>
          <p className="mem-sub">
            Unlimited off-peak access on every plan with peak hours included on Standard and Elite
          </p>
          <div className="mem-billing-toggle" aria-label="Billing options">
            <button
              type="button"
              className={billing === 'monthly' ? 'is-active' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'annual' ? 'is-active' : ''}
              onClick={() => setBilling('annual')}
            >
              Annual <strong>2 months free</strong>
            </button>
          </div>
        </div>
      </section>

      <section className="mem-tiers" aria-label="Membership plans">
        <div className="mem-wrap">
          <div className="mem-tier-grid">
            {TIERS.map(tier => (
              <article key={tier.name} className={`mem-tier${tier.featured ? ' is-featured' : ''}`}>
                {tier.featured && <span className="mem-tier-flag">Most members start here</span>}
                <p className="mem-tier-name" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{tier.name}</p>
                <p className="mem-tier-pitch">{tier.pitch}</p>
                <div className="mem-tier-price">
                  <span className="mem-tier-price-num">{billing === 'monthly' ? tier.monthly : tier.annual}</span>
                  <span className="mem-tier-price-mo">{period}</span>
                </div>
                <a className="mem-tier-cta" href={`/memberships/checkout?plan=${tier.name.toLowerCase()}&billing=${billing}`}>
                  {tier.cta}
                </a>
                <div className="mem-tier-divider" />
                <ul className="mem-tier-features">
                  {tier.features.map((feature, index) => (
                    <li key={`${tier.name}-${index}`} className={`${feature.strong ? 'is-strong' : ''}${feature.muted ? ' is-mute' : ''}`}>
                      {feature.muted ? <MinusIcon /> : <CheckIcon />}
                      <span>{feature.strong && <strong>{feature.strong}</strong>}{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mem-hours-section" aria-labelledby="mem-hours-title">
        <div className="mem-wrap">
          <div className="mem-hours-card">
            <div className="mem-hours-head">
              <ClockIcon />
              <h2 id="mem-hours-title">Peak and off-peak hours</h2>
            </div>
            <div className="mem-hours-rows">
              <div className="mem-hours-row">
                <span className="mem-hours-pill peak">Peak</span>
                <span className="mem-hours-desc">Weekdays 5-10 PM and weekends outside night hours</span>
                <span className="mem-hours-rate">$60<small>/ hr hourly</small></span>
              </div>
              <div className="mem-hours-row">
                <span className="mem-hours-pill off">Off-peak</span>
                <span className="mem-hours-desc">Weekdays before 5 PM</span>
                <span className="mem-hours-rate">$45<small>/ hr hourly</small></span>
              </div>
              <div className="mem-hours-row">
                <span className="mem-hours-pill night">Night</span>
                <span className="mem-hours-desc">Every night from 10 PM to 6 AM</span>
                <span className="mem-hours-rate">$30<small>/ hr hourly</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mem-compare-section" aria-label="Compare memberships">
        <div className="mem-wrap">
          <div className="mem-compare-head">
            <h2>Compare head to head</h2>
          </div>
          <div className="mem-compare-table">
            <div className="mem-compare-row head">
              <div className="mem-compare-cell">&nbsp;</div>
              <div className="mem-compare-cell">Practice</div>
              <div className="mem-compare-cell">Standard</div>
              <div className="mem-compare-cell">Elite</div>
            </div>
            {COMPARE_ROWS.map(([label, practice, standard, elite]) => (
              <div className="mem-compare-row" key={label}>
                <div className="mem-compare-cell row-label">{label}</div>
                <div className="mem-compare-cell" data-tier="Practice">{practice}</div>
                <div className="mem-compare-cell" data-tier="Standard">{standard}</div>
                <div className="mem-compare-cell" data-tier="Elite">{elite}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mem-reassure" aria-label="Membership details">
        <div className="mem-wrap">
          <div className="mem-reassure-grid">
            <div className="mem-reassure-card">
              <div className="mem-reassure-icon"><ShieldIcon /></div>
              <div>
                <h3>Cancel anytime</h3>
                <p>Monthly memberships are paid through the end of the current month.</p>
              </div>
            </div>
            <div className="mem-reassure-card">
              <div className="mem-reassure-icon"><CardIcon /></div>
              <div>
                <h3>Annual value is built in</h3>
                <p>Annual pricing equals 10 months. Cancel and the remaining balance is refunded after the current month.</p>
              </div>
            </div>
            <div className="mem-reassure-card">
              <div className="mem-reassure-icon"><ClockIcon /></div>
              <div>
                <h3>Guests are included</h3>
                <p>Every tier includes up to 3 guests per booking.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mem-faq">
        <div className="mem-wrap">
          <h2>Quick questions</h2>
          <p className="mem-faq-lead">A few details that matter before choosing a plan</p>
          <div className="mem-faq-list">
            <details className="mem-faq-item" open>
              <summary>What counts as off-peak?</summary>
              <p>Off-peak is weekdays before 5 PM. Peak is weekdays from 5-10 PM and weekends outside night hours.</p>
            </details>
            <details className="mem-faq-item">
              <summary>Can I bring guests?</summary>
              <p>Yes. You can bring up to 3 guests per booking.</p>
            </details>
            <details className="mem-faq-item">
              <summary>Can I cancel?</summary>
              <p>Members can cancel anytime. Monthly memberships are paid through the end of the current month.</p>
            </details>
            <details className="mem-faq-item">
              <summary>How does annual cancellation work?</summary>
              <p>Annual members pay the monthly rate through the end of the month they cancel in, and the remainder is refunded.</p>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
