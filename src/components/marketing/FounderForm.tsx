'use client'

import { useState } from 'react'
import { submitFounderApplication, createSetupIntent } from '@/app/(marketing)/join/actions'

const TIERS = [
  { value: 'gold', label: 'Gold — $279/mo founding rate', sub: '2-hr sessions, 30-day advance booking' },
  { value: 'silver', label: 'Silver — $219/mo founding rate', sub: '90-min sessions, 14-day advance booking' },
  { value: 'bronze', label: 'Bronze — $149/mo founding rate', sub: '60-min sessions, 7-day advance booking' },
  { value: 'undecided', label: "Not sure yet — let me decide later", sub: '' },
]

interface FounderFormProps {
  stripePublishableKey: string
}

export function FounderForm({ stripePublishableKey: _ }: FounderFormProps) {
  const [step, setStep] = useState<'info' | 'tier' | 'card' | 'submitting'>('info')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tier, setTier] = useState('gold')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState('')
  const [setupIntentId, setSetupIntentId] = useState('')
  const [stripeCustomerId, setStripeCustomerId] = useState('')

  // Step 1 → Step 2
  function handleInfoNext(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !email.trim()) return
    setStep('tier')
  }

  // Step 2 → Step 3 (create SetupIntent, load Stripe)
  async function handleTierNext() {
    setError('')
    setStep('card')
    try {
      const { clientSecret, customerId } = await createSetupIntent(email)
      // Stripe Elements would mount here — for now store the setup intent
      // In full implementation, use @stripe/react-stripe-js Elements
      setSetupIntentId(clientSecret.split('_secret_')[0]!)
      setStripeCustomerId(customerId)
    } catch {
      setError('Failed to set up payment. Please try again.')
      setStep('tier')
    }
  }

  // Final submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('submitting')

    const fd = new FormData()
    fd.append('firstName', firstName)
    fd.append('lastName', lastName)
    fd.append('email', email)
    fd.append('phone', phone ? `+1${phone.replace(/\D/g, '').slice(-10)}` : '')
    fd.append('interestedTier', tier)
    fd.append('setupIntentId', setupIntentId)
    if (stripeCustomerId) fd.append('stripeCustomerId', stripeCustomerId)
    if (marketingConsent) fd.append('marketingConsent', 'on')
    if (smsConsent) fd.append('smsConsent', 'on')

    const result = await submitFounderApplication(fd)
    if (result?.error) {
      setError(result.error)
      setStep('card')
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', height: 48, borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)', background: '#1a1a1a',
    color: '#fff', padding: '0 16px', fontSize: '0.95rem', outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.5)', marginBottom: 6,
  }

  const btnStyle: React.CSSProperties = {
    display: 'block', width: '100%', height: 52, borderRadius: 10,
    background: '#1B4332', color: '#D4AF37', border: '1px solid #D4AF37',
    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit',
  }

  if (step === 'submitting') {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.6)' }}>
        Reserving your spot…
      </div>
    )
  }

  return (
    <div>
      {error && (
        <p style={{ color: '#e8735a', fontSize: '0.88rem', marginBottom: 16 }}>{error}</p>
      )}

      {step === 'info' && (
        <form onSubmit={handleInfoNext} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>First name *</label>
              <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Last name</label>
              <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(203) 555-0100" />
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>For booking reminders and your access code. Optional.</p>
          </div>
          <button type="submit" style={btnStyle}>Continue →</button>
        </form>
      )}

      {step === 'tier' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            Choose your starting tier — you can change before we open.
          </p>
          {TIERS.map(t => (
            <label
              key={t.value}
              style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${tier === t.value ? '#c9a84c' : 'rgba(255,255,255,0.1)'}`,
                background: tier === t.value ? 'rgba(201,168,76,0.07)' : 'transparent',
              }}
            >
              <input type="radio" name="tier" value={t.value} checked={tier === t.value}
                onChange={() => setTier(t.value)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: tier === t.value ? '#fff' : 'rgba(255,255,255,0.8)' }}>
                  {t.label}
                </div>
                {t.sub && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{t.sub}</div>}
              </div>
            </label>
          ))}

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} style={{ marginTop: 3, accentColor: '#c9a84c' }} />
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                Email me updates, promotions, and league news
              </span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} style={{ marginTop: 3, accentColor: '#c9a84c' }} />
              <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                Text me booking reminders and access codes (required for SMS features)
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setStep('info')}
              style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', flex: '0 0 auto', width: 'auto', padding: '0 20px' }}>
              ← Back
            </button>
            <button type="button" onClick={() => void handleTierNext()} style={{ ...btnStyle, flex: 1 }}>
              Save card & reserve spot →
            </button>
          </div>
        </div>
      )}

      {step === 'card' && (
        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ padding: '20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, background: '#111' }}>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              Your card is saved now and charged only when we open Fall 2026. Cancel any time before then.
            </p>
            {/* Stripe Elements mounts here in production — setupIntentId: {setupIntentId} */}
            <div style={{ padding: '12px', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
              Stripe Elements card field (mounts with @stripe/react-stripe-js)
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
            By reserving, you agree to our{' '}
            <a href="/terms.html" style={{ color: 'rgba(255,255,255,0.5)' }}>Terms of Use</a>
            {' '}and{' '}
            <a href="/privacy-policy.html" style={{ color: 'rgba(255,255,255,0.5)' }}>Privacy Policy</a>.
            Your card will not be charged until opening day.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStep('tier')}
              style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', flex: '0 0 auto', width: 'auto', padding: '0 20px' }}>
              ← Back
            </button>
            <button type="submit" style={{ ...btnStyle, flex: 1 }}>
              Reserve my founding spot →
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
