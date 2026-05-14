'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  createFoundingPaymentIntent,
  submitFounderData,
} from '@/app/(marketing)/join/actions'

// ── Tier config ───────────────────────────────────────────────────────────────

const TIERS = [
  {
    name: 'Practice',
    price: 119,
    regular: 149,
    access: 'Unlimited off-peak *',
    accessNote: 'Peak hours not included',
    booking: '7-day advance',
    bestFor: 'Practice and off-peak play',
    tagline: 'Built for easy, consistent reps.',
    elite: false,
  },
  {
    name: 'Standard',
    price: 229,
    regular: 279,
    access: '8 peak hours/month + unlimited off-peak',
    booking: '10-day advance',
    bestFor: 'Regular rounds and flexible play',
    tagline: 'The core membership.',
    elite: false,
  },
  {
    name: 'Elite',
    price: 349,
    regular: 419,
    access: '16 peak hours/month + unlimited off-peak',
    booking: '14-day advance',
    bestFor: 'Priority access and full rounds',
    tagline: 'Priority access when demand is highest.',
    elite: true,
    flagText: '5 spots only',
  },
] as const

type Tier = (typeof TIERS)[number]

// ── Progress / step labels ────────────────────────────────────────────────────

const FOUNDER_PROGRESS: Record<number, number> = { 1: 12, 2: 32, 3: 52, 4: 72, 6: 93, 7: 100 }
const UPDATES_PROGRESS: Record<number, number> = { 1: 18, 2: 52, 3: 86, 7: 100 }
const FOUNDER_STEPS: Record<number, string> = {
  1: '1 of 4', 2: '2 of 4', 3: '3 of 4', 4: '4 of 4', 6: 'Final step',
}
const UPDATES_STEPS: Record<number, string> = { 1: '1 of 3', 2: '2 of 3', 3: '3 of 3' }

// ── Stripe lazy init (module-level) ──────────────────────────────────────────

let _stripePromise: ReturnType<typeof loadStripe> | null = null
function getStripe(pk: string): ReturnType<typeof loadStripe> {
  if (!_stripePromise && pk) _stripePromise = loadStripe(pk)
  return _stripePromise!
}

const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#8fa65e',
    colorBackground: '#111111',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255,255,255,0.7)',
    colorDanger: '#e8735a',
    fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
    borderRadius: '8px',
  },
  rules: {
    '.Input': { border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' },
    '.Input:focus': { border: '1px solid #8fa65e', boxShadow: 'none' },
    '.Tab': { border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#111111' },
    '.Tab:hover': { border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)' },
    '.Tab--selected': { border: '1px solid #8fa65e', backgroundColor: 'rgba(143,166,94,0.08)' },
    '.Tab--selected:hover': { border: '1px solid #8fa65e', backgroundColor: 'rgba(143,166,94,0.08)' },
  },
}

// ── Payment slide inner (needs useStripe / useElements) ──────────────────────

interface PaymentSlideProps {
  isActive: boolean
  tier: Tier
  fullName: string
  email: string
  onSuccess: () => void
}

function PaymentSlideInner({ isActive, tier, fullName, email, onSuccess }: PaymentSlideProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardComplete, setCardComplete] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [showWhyHold, setShowWhyHold] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const savings = tier.regular - tier.price

  const ready = !!stripe && !!elements
  const btnDisabled = loading || !ready || !cardComplete || !termsChecked
  const btnText = loading
    ? 'Processing…'
    : !ready
    ? 'Loading secure card form…'
    : !cardComplete
    ? 'Enter card details to continue'
    : !termsChecked
    ? 'Agree to terms to continue'
    : 'Verify card & reserve spot →'

  async function handleConfirm() {
    if (!stripe || !elements) return
    if (!termsChecked) {
      setError('Please agree to the Terms of Use to continue.')
      return
    }
    if (!cardComplete) {
      setError('Please complete your card details.')
      return
    }
    setLoading(true)
    setError('')

    const { error: stripeErr } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: typeof window !== 'undefined'
          ? `${window.location.origin}/join`
          : 'https://www.strikepointsims.com/join',
        payment_method_data: {
          billing_details: { name: fullName, email },
        },
      },
    })

    if (stripeErr) {
      setError(stripeErr.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <div className={`slide payment-slide${isActive ? ' is-active' : ''}`} data-slide="6">
      <div className="slide-inner">
        <p className="slide-step">Final step</p>
        <h2 className="slide-q">Finish your reservation</h2>
        <p className="slide-hint">
          Save your card to secure your Founder spot. No membership charges until we open.
        </p>

        {/* Plan summary */}
        <div className="selected-plan-summary">
          <div className="checkout-plan-top">
            <div>
              <span className="checkout-plan-label">Selected membership</span>
              <strong className="checkout-plan-name">{tier.name}</strong>
            </div>
            <div className="checkout-price" aria-label="Founder membership price">
              <span className="checkout-price-currency">$</span>
              <span className="checkout-price-number">{tier.price}</span>
              <span className="checkout-price-mo">/mo</span>
            </div>
          </div>
          <div className="checkout-plan-meta">
            <span><strong>Founder rate</strong></span>
            <span>Regular <s>${tier.regular}/mo</s></span>
            <span>Saves ${savings}/mo</span>
          </div>
          <p className="checkout-plan-note">
            Only 20 founding memberships available. Your card is saved today; membership billing starts when we open.
          </p>
        </div>

        {/* $1 hold note */}
        <p className="input-fine hold-note">
          Your card will be verified with a $1 temporary hold. It automatically disappears.
          <span className="why-hold" onClick={() => setShowWhyHold(v => !v)}>Why $1?</span>
        </p>
        {showWhyHold && (
          <p className="input-fine why-hold-text" style={{ display: 'block' }}>
            The $1 authorization confirms the card is valid so we can hold your Founding spot. It is not captured as a payment and typically disappears from pending charges in 3–10 days.
          </p>
        )}

        {/* Stripe elements */}
        <div className="stripe-card-section" style={{ display: 'block' }}>
          <label className="terms-agree">
            <input
              type="checkbox"
              id="terms-check"
              checked={termsChecked}
              onChange={e => {
                setTermsChecked(e.target.checked)
                if (e.target.checked) setError('')
              }}
            />
            <span className="terms-agree-text">
              I agree to the{' '}
              <a href="/terms.html" target="_blank" rel="noreferrer">
                Terms of Use &amp; Membership Agreement
              </a>
            </span>
          </label>

          <ExpressCheckoutElement
            onConfirm={handleConfirm}
            options={{
              wallets: { applePay: 'auto', googlePay: 'auto' },
              buttonType: { applePay: 'plain', googlePay: 'plain' },
            }}
          />

          <div className="stripe-wallet-divider">Card verification</div>

          <PaymentElement
            onChange={e => {
              setCardComplete(e.complete)
            }}
            options={{
              layout: {
                type: 'accordion',
                defaultCollapsed: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
              },
              wallets: { applePay: 'never', googlePay: 'never' },
              fields: { billingDetails: { name: 'auto', email: 'auto' } },
              paymentMethodOrder: ['card'],
            }}
          />

          {error && <p className="input-error" style={{ marginTop: 8 }}>{error}</p>}

          <div className="payment-submit-row">
            <button
              className="inline-primary-btn"
              type="button"
              onClick={handleConfirm}
              disabled={btnDisabled}
            >
              {btnText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main FounderForm component ────────────────────────────────────────────────

interface FounderFormProps {
  stripePublishableKey: string
}

export function FounderForm({ stripePublishableKey }: FounderFormProps) {
  const stripePromise = getStripe(stripePublishableKey)

  // ─ Screen / transition state ─
  const [formVisible, setFormVisible] = useState(false)
  const [formShown, setFormShown] = useState(false)
  const [offerHiding, setOfferHiding] = useState(false)

  // ─ Flow state ─
  const [isFounder, setIsFounder] = useState(true)
  const [currentSlide, setCurrentSlide] = useState<1 | 2 | 3 | 4 | 6 | 7>(1)
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null)
  const [reservationNextVisible, setReservationNextVisible] = useState(false)

  // ─ Slide data ─
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [firstNameError, setFirstNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [golfLevel, setGolfLevel] = useState('')
  const [community, setCommunity] = useState('')
  const [communityOther, setCommunityOther] = useState('')
  const [priority, setPriority] = useState<string[]>([])

  // ─ Stripe state ─
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [fetchingIntent, setFetchingIntent] = useState(false)
  const [intentError, setIntentError] = useState('')

  // ─ Refs ─
  const otherTownRef = useRef<HTMLInputElement>(null)
  const slide1FirstRef = useRef<HTMLInputElement>(null)

  // ─ Derived ─
  const progressPct = (isFounder ? FOUNDER_PROGRESS : UPDATES_PROGRESS)[currentSlide] ?? 0
  const stepLabel = (isFounder ? FOUNDER_STEPS : UPDATES_STEPS)[currentSlide] ?? ''
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')

  const slide1Heading = isFounder && selectedTier
    ? `Finish your ${selectedTier.name} reservation.`
    : 'Where should we send updates?'
  const slide1Hint = isFounder
    ? "We'll use this for your confirmation and opening updates."
    : 'Build progress, opening news, and when bookings go live.'

  const navHidden = currentSlide === 7 || currentSlide === 6
  const isChoiceSlide = currentSlide === 2 || currentSlide === 3
  const isPrioritySlide = currentSlide === 4
  const showNextBtn = !isChoiceSlide

  // ─ URL param: ?mode=updates ─
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('updates') === '1' || params.get('mode') === 'updates') {
      openForm(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─ Screen transitions ─
  function openForm(asFounder: boolean) {
    if (asFounder && !selectedTier) return
    setIsFounder(asFounder)
    setCurrentSlide(1)
    setFormVisible(true)
    document.body.style.overflow = 'hidden'
    setOfferHiding(true)
    setTimeout(() => {
      setFormShown(true)
      slide1FirstRef.current?.focus()
    }, 50)
  }

  function closeForm() {
    setFormShown(false)
    setTimeout(() => {
      setFormVisible(false)
      setOfferHiding(false)
      document.body.style.overflow = ''
    }, 400)
  }

  // ─ Slide navigation ─
  function goToSlide(n: 1 | 2 | 3 | 4 | 6 | 7) {
    setCurrentSlide(n)
    if (n === 6 && !clientSecret && !fetchingIntent) {
      fetchPaymentIntent()
    }
  }

  async function fetchPaymentIntent() {
    if (clientSecret || fetchingIntent) return
    setFetchingIntent(true)
    setIntentError('')
    try {
      const result = await createFoundingPaymentIntent(
        email.trim(),
        fullName,
        selectedTier?.name ?? '',
      )
      setClientSecret(result.clientSecret)
    } catch {
      setIntentError('Payment system unavailable. Please try again.')
    } finally {
      setFetchingIntent(false)
    }
  }

  // ─ Slide 1 validation ─
  function validateSlide1(): boolean {
    let ok = true
    const fn = firstName.trim()
    const em = email.trim()
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!fn || fn.length < 2) {
      setFirstNameError(fn ? 'Please enter your full first name' : 'Please enter your first name')
      ok = false
    } else {
      setFirstNameError('')
    }
    if (!em || !re.test(em)) {
      setEmailError(em ? "That doesn’t look right" : 'Please enter your email')
      ok = false
    } else {
      setEmailError('')
    }
    return ok
  }

  // ─ Next / Prev ─
  function nextSlide() {
    if (currentSlide === 1 && !validateSlide1()) return
    if (currentSlide === 3) {
      if (community === 'other' && !communityOther.trim()) return
      if (isFounder) { goToSlide(4); return }
      handleFinalSubmit(); return
    }
    if (currentSlide === 4) { goToSlide(6); return }
    if (currentSlide < 4) goToSlide((currentSlide + 1) as 1 | 2 | 3 | 4 | 6 | 7)
  }

  function prevSlide() {
    if (currentSlide === 6) { goToSlide(4); return }
    if (currentSlide > 1) goToSlide((currentSlide - 1) as 1 | 2 | 3 | 4 | 6 | 7)
  }

  // ─ Choice handlers ─
  function selectGolfLevel(level: string) {
    setGolfLevel(level)
    setTimeout(() => goToSlide(3), 280)
  }

  function selectCommunity(val: string) {
    setCommunity(val)
    if (val !== 'other') {
      setTimeout(() => {
        if (isFounder) goToSlide(4)
        else handleFinalSubmit()
      }, 280)
    }
  }

  function togglePriority(val: string) {
    setPriority(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val],
    )
  }

  // ─ Final submit ─
  function handleFinalSubmit() {
    goToSlide(7)
    void submitFounderData({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      interestedTier: selectedTier?.name ?? 'none',
      golfLevel,
      community: community === 'other' ? communityOther.trim() : community,
      priority: priority.join(', '),
      isFounder,
    }).catch(console.error)
  }

  // ─ Keyboard handler ─
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!formShown || currentSlide === 7) return

    if (e.key === 'Enter') {
      const active = document.activeElement as HTMLElement
      if (active?.id === 'other-town-input') {
        if (community === 'other' && communityOther.trim()) {
          e.preventDefault()
          if (isFounder) goToSlide(4)
          else handleFinalSubmit()
        }
        return
      }
      if (currentSlide === 1 || currentSlide === 4) {
        e.preventDefault()
        nextSlide()
      }
      return
    }

    const k = e.key.toLowerCase()
    const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6 }
    const idx = map[k]
    if (idx === undefined || currentSlide < 2 || currentSlide > 4) return
    if ((document.activeElement as HTMLElement)?.id === 'other-town-input') return

    if (currentSlide === 2) {
      const levels = [
        'I play often and want to improve',
        'I play regularly during the season',
        'I play occasionally, mostly with friends',
        "I'm newer to golf or just getting into it",
      ]
      if (levels[idx]) selectGolfLevel(levels[idx])
    } else if (currentSlide === 3) {
      const towns = ['Colchester', 'Hebron', 'Marlborough', 'Glastonbury', 'East Hampton', 'Lebanon', 'other']
      if (towns[idx]) selectCommunity(towns[idx])
    } else if (currentSlide === 4) {
      const opts = [
        'Accuracy of the shot data',
        'Being able to play on my own schedule',
        'Having somewhere to play year-round',
        'A golf-focused atmosphere',
        'Access to a wide variety of courses',
        'Leagues and competitive events',
      ]
      if (opts[idx]) togglePriority(opts[idx])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formShown, currentSlide, community, communityOther, isFounder, firstName, lastName, email, priority])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ─ Confirmation copy ─
  const confirmHeading = isFounder && selectedTier
    ? `You’re in${firstName ? `, ${firstName.trim()}` : ''}.`
    : `You’re on the list${firstName ? `, ${firstName.trim()}` : ''}.`
  const confirmBody = isFounder && selectedTier
    ? `Your ${selectedTier.name} spot is reserved. Your first membership charge happens when we open.`
    : "You'll get build updates, opening news, and when bookings go live."
  const confirmSubbody = isFounder && selectedTier
    ? "We’ll follow up as we get closer with membership details, preview timing, and opening updates."
    : 'No spam. Just updates that matter.'
  const showReserveLink = !isFounder || !selectedTier

  // ─ Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ═══════════════════ OFFER SCREEN ═══════════════════ */}
      <div
        id="offer-screen"
        className={offerHiding ? 'hiding' : ''}
        style={formVisible && !offerHiding ? { display: 'none' } : undefined}
      >
        <div className="offer-wrap">

          {/* Top bar */}
          <div className="topbar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="/"><img src="/logohorizontal.png" alt="StrikePoint Sims" className="topbar-logo" /></a>
            <a href="/" className="topbar-back">&larr; Home</a>
          </div>

          <span className="offer-eyebrow">Only 20 spots</span>
          <h1 className="offer-heading">Choose your Founding membership</h1>

          <div className="offer-lead-block">
            <p><strong>Twenty spots. Lifetime preferred pricing. Your name displayed on the wall.</strong></p>
            <div className="offer-mini-cards">
              <div className="offer-mini-card">
                <span className="dot" />
                <div>
                  <strong>Satisfaction guarantee</strong>
                  <p>If it&rsquo;s not what we promised, cancel within 14 days after opening for a full refund.</p>
                </div>
              </div>
              <div className="offer-mini-card">
                <span className="dot" />
                <div>
                  <strong>Preferred pricing for life</strong>
                  <p>Save $30&ndash;$70/mo off public rates while your membership stays active.</p>
                </div>
              </div>
            </div>
          </div>

          <span className="pricing-label">Select One</span>

          {/* Tier grid */}
          <div className="tier-grid">
            {TIERS.map(tier => (
              <div
                key={tier.name}
                className={[
                  'tier',
                  'tier-selectable',
                  tier.elite ? 'tier--elite' : '',
                  selectedTier?.name === tier.name ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  setSelectedTier(tier)
                  setReservationNextVisible(true)
                  const btn = document.getElementById('start-form-btn') as HTMLButtonElement | null
                  if (btn) {
                    btn.disabled = false
                    btn.textContent = `Continue with ${tier.name} →`
                  }
                }}
              >
                <span className="tier-selected-pill">Selected</span>
                {tier.elite && 'flagText' in tier && (
                  <div className="tier-flag">{(tier as { flagText?: string }).flagText}</div>
                )}
                <div className="tier-name">{tier.name}</div>
                <div className="tier-price">
                  <span className="tier-price-num">
                    <span className="tier-price-currency">$</span>{tier.price}
                  </span>
                  <span className="tier-price-mo">/mo</span>
                </div>
                <div className="tier-price-was">Regular ${tier.regular}/mo</div>
                <div className="tier-desc">
                  <div className="tier-row">
                    <span className="tier-row-label">Access</span>
                    <span>
                      {tier.access}
                      {'accessNote' in tier && (tier as { accessNote?: string }).accessNote && (
                        <><br /><span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82em' }}>
                          {(tier as { accessNote?: string }).accessNote}
                        </span></>
                      )}
                    </span>
                  </div>
                  <div className="tier-row">
                    <span className="tier-row-label">Booking</span>
                    <span>{tier.booking}</span>
                  </div>
                  <div className="tier-row">
                    <span className="tier-row-label">Best for</span>
                    <span>{tier.bestFor}</span>
                  </div>
                  <div className="tier-tagline">{tier.tagline}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="tier-footnote">
            * Off-peak: weekdays before 5pm &amp; nights 10pm&ndash;6am &nbsp;&middot;&nbsp; All tiers include guest privileges
          </p>

          {/* What happens next */}
          <div className={`reservation-next${reservationNextVisible ? ' is-visible' : ''}`}>
            <div className="reservation-next-title">What happens next</div>
            <ul className="reservation-next-list">
              <li>Your card is saved today to reserve your spot</li>
              <li>You are not charged until we open in Fall 2026</li>
              <li>You can cancel anytime before opening</li>
              <li>14-day satisfaction guarantee after launch</li>
            </ul>
          </div>

          {/* CTA */}
          <div className="offer-start-wrap">
            <button
              className="offer-btn"
              id="start-form-btn"
              disabled={!selectedTier}
              onClick={() => openForm(true)}
            >
              {selectedTier ? `Continue with ${selectedTier.name} →` : 'Choose a membership above'}
            </button>
            <p className="offer-fine">No charge today. Billing begins when we open.</p>
          </div>

        </div>
      </div>

      {/* ═══════════════════ FORM SCREEN ═══════════════════ */}
      <div
        id="form-screen"
        className={[formVisible ? 'visible' : '', formShown ? 'shown' : ''].filter(Boolean).join(' ')}
      >
        {/* Form top bar */}
        <div className="form-topbar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logohorizontal.png" alt="StrikePoint Sims" className="form-topbar-logo" />
          <button className="form-close-btn" onClick={closeForm} aria-label="Back to offer">&times;</button>
        </div>

        {/* Progress bar */}
        <div className="form-progress-bar">
          <div className="form-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Slides */}
        <div className="slides-stage">

          {/* Slide 1: Name + Email */}
          <div className={`slide${currentSlide === 1 ? ' is-active' : ''}`} data-slide="1">
            <div className="slide-inner">
              <p className="slide-step">{stepLabel}</p>
              <h2 className="slide-q">{slide1Heading}</h2>
              <p className="slide-hint">{slide1Hint}</p>

              {isFounder && selectedTier && (
                <div className="founding-notice">
                  <span className="founding-notice-icon">⛳</span>
                  <span className="founding-notice-text">
                    You&rsquo;re only a few short steps away from securing your spot.
                  </span>
                </div>
              )}

              <div className="name-grid">
                <div className="input-group">
                  <span className="input-label">First name</span>
                  <input
                    ref={slide1FirstRef}
                    className={`slide-input${firstNameError ? ' has-error' : ''}`}
                    type="text"
                    id="field-first-name"
                    placeholder="First name"
                    autoComplete="given-name"
                    autoCapitalize="words"
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); if (firstNameError) setFirstNameError('') }}
                  />
                  <p className="input-error">{firstNameError}</p>
                </div>
                <div className="input-group">
                  <span className="input-label">Last name</span>
                  <input
                    className="slide-input"
                    type="text"
                    placeholder="Last name"
                    autoComplete="family-name"
                    autoCapitalize="words"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <span className="input-label">Email</span>
                <input
                  className={`slide-input${emailError ? ' has-error' : ''}`}
                  type="email"
                  id="field-email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                />
                <p className="input-error">{emailError}</p>
              </div>
            </div>
          </div>

          {/* Slide 2: Golf level */}
          <div className={`slide${currentSlide === 2 ? ' is-active' : ''}`} data-slide="2">
            <div className="slide-inner">
              <p className="slide-step">{isFounder ? '2 of 4' : '2 of 3'}</p>
              <h2 className="slide-q">How does golf fit into your life?</h2>
              <div className="choices" id="level-choices">
                {[
                  { key: 'A', val: 'I play often and want to improve', desc: '50+ rounds a year. Always sharpening my game.' },
                  { key: 'B', val: 'I play regularly during the season', desc: 'About once a week in season.' },
                  { key: 'C', val: 'I play occasionally, mostly with friends', desc: 'A handful of rounds a year, mostly with friends.' },
                  { key: 'D', val: "I'm newer to golf or just getting into it", desc: 'Curious about golf or just getting started.' },
                ].map(opt => (
                  <div
                    key={opt.key}
                    className={`choice${golfLevel === opt.val ? ' is-selected' : ''}`}
                    onClick={() => selectGolfLevel(opt.val)}
                  >
                    <div className="choice-key">{opt.key}</div>
                    <div className="choice-content">
                      <div className="choice-title">{opt.val}</div>
                      <div className="choice-desc">{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Slide 3: Town */}
          <div className={`slide${currentSlide === 3 ? ' is-active' : ''}`} data-slide="3">
            <div className="slide-inner">
              <p className="slide-step">{isFounder ? '3 of 4' : '3 of 3'}</p>
              <h2 className="slide-q">Where are you coming from?</h2>
              <div className="choices" id="town-choices">
                {[
                  { key: 'A', val: 'Colchester' },
                  { key: 'B', val: 'Hebron' },
                  { key: 'C', val: 'Marlborough' },
                  { key: 'D', val: 'Glastonbury' },
                  { key: 'E', val: 'East Hampton' },
                  { key: 'F', val: 'Lebanon' },
                  { key: 'G', val: 'other', label: 'Somewhere else' },
                ].map(opt => (
                  <div
                    key={opt.key}
                    className={`choice${community === opt.val ? ' is-selected' : ''}`}
                    onClick={() => selectCommunity(opt.val)}
                  >
                    <div className="choice-key">{opt.key}</div>
                    <div className="choice-content">
                      <div className="choice-title">{opt.label ?? opt.val}</div>
                      {opt.val === 'other' && community === 'other' && (
                        <input
                          ref={otherTownRef}
                          className="choice-other-input"
                          id="other-town-input"
                          type="text"
                          placeholder="Your town"
                          value={communityOther}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setCommunityOther(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {community === 'other' && (
                <div className="inline-slide-actions" style={{ marginTop: 20 }}>
                  <button
                    className="inline-primary-btn"
                    type="button"
                    onClick={() => {
                      if (!communityOther.trim()) return
                      if (isFounder) goToSlide(4)
                      else handleFinalSubmit()
                    }}
                  >
                    OK &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Slide 4: Priority (multi-select, founder only) */}
          <div className={`slide${currentSlide === 4 ? ' is-active' : ''}`} data-slide="4">
            <div className="slide-inner">
              <p className="slide-step">4 of 4</p>
              <h2 className="slide-q">What matters most to you in a sim facility?</h2>
              <div className="choices" id="priority-choices">
                {[
                  { key: 'A', val: 'Accuracy of the shot data' },
                  { key: 'B', val: 'Being able to play on my own schedule' },
                  { key: 'C', val: 'Having somewhere to play year-round' },
                  { key: 'D', val: 'A golf-focused atmosphere' },
                  { key: 'E', val: 'Access to a wide variety of courses' },
                  { key: 'F', val: 'Leagues and competitive events' },
                ].map(opt => (
                  <div
                    key={opt.key}
                    className={`choice${priority.includes(opt.val) ? ' is-selected' : ''}`}
                    onClick={() => togglePriority(opt.val)}
                  >
                    <div className="choice-key">{opt.key}</div>
                    <div className="choice-content">
                      <div className="choice-title">{opt.val}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="inline-slide-actions">
                <button className="inline-primary-btn" type="button" onClick={nextSlide}>
                  Continue &rarr;
                </button>
                <span className="inline-action-note">Optional — choose any that apply.</span>
              </div>
            </div>
          </div>

          {/* Slide 6: Payment (founder only) — wrapped in Elements once clientSecret available */}
          {clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
            >
              <PaymentSlideInner
                isActive={currentSlide === 6}
                tier={selectedTier ?? TIERS[0]}
                fullName={fullName}
                email={email.trim()}
                onSuccess={handleFinalSubmit}
              />
            </Elements>
          ) : (
            <div className={`slide payment-slide${currentSlide === 6 ? ' is-active' : ''}`} data-slide="6">
              <div className="slide-inner">
                <p className="slide-step">Final step</p>
                <h2 className="slide-q">Finish your reservation</h2>
                {intentError ? (
                  <p style={{ color: 'var(--error)', marginTop: 16 }}>{intentError}</p>
                ) : (
                  <p className="slide-hint" style={{ marginTop: 16 }}>Loading payment form&hellip;</p>
                )}
              </div>
            </div>
          )}

          {/* Slide 7: Confirmation */}
          <div className={`slide${currentSlide === 7 ? ' is-active' : ''}`} data-slide="7">
            <div className="slide-inner slide-inner--center">
              <div className={`confirm-icon${!isFounder || !selectedTier ? ' confirm-icon--accent' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="4 12 10 18 20 6" />
                </svg>
              </div>
              <h2 className="confirm-heading">{confirmHeading}</h2>
              <p className="confirm-body">{confirmBody}</p>
              <p className="confirm-body" style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginTop: -10 }}>
                {confirmSubbody}
              </p>
              <div className="confirm-actions">
                {showReserveLink && (
                  <a href="/join" className="confirm-reserve-link">Lock in founding pricing &rarr;</a>
                )}
                <a href="/" className="confirm-home-link">Back to home</a>
              </div>
            </div>
          </div>

        </div>{/* /slides-stage */}

        {/* Slide nav */}
        {!navHidden && (
          <div className="slide-nav" id="slide-nav">
            <button
              className="nav-back-btn"
              id="back-btn"
              onClick={prevSlide}
              disabled={currentSlide <= 1}
            >
              &larr; Back
            </button>
            <span className="slide-hint-key" id="key-hint">
              {isChoiceSlide ? 'press A–G to choose' : isPrioritySlide ? 'choose any · then Enter' : 'press Enter ↵'}
            </span>
            {showNextBtn && !isPrioritySlide && (
              <button className="nav-next-btn" id="next-btn" onClick={nextSlide}>
                OK &rarr;
              </button>
            )}
          </div>
        )}

      </div>{/* /form-screen */}
    </>
  )
}
