'use client'

import { use, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { checkUserExists } from '@/app/(auth)/login/actions'

type Mode = 'choose' | 'email' | 'phone' | 'terms' | 'otp'
type Intent = 'signin' | 'signup'

interface LoginFormProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const { callbackUrl } = use(searchParams)
  const router = useRouter()
  const redirectTo = callbackUrl ?? '/account'

  const [mode, setMode] = useState<Mode>('choose')
  const [intent, setIntent] = useState<Intent>('signin')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [pendingIntent, setPendingIntent] = useState<'email' | 'phone' | null>(null)

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return '+1' + digits.slice(-10)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (intent === 'signup') {
        // Skip existence check — go straight to terms
        setPendingIntent('email')
        setMode('terms')
        return
      }
      const isExisting = await checkUserExists(email, 'email')
      if (!isExisting) {
        setPendingIntent('email')
        setMode('terms')
        return
      }
      await sendMagicLink()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink() {
    await signIn('email', { email, callbackUrl: redirectTo, redirect: false })
    router.push('/login/check-email')
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const e164 = formatPhone(phone)
    if (e164.length !== 12) {
      setError('Enter your 10-digit US phone number.')
      setLoading(false)
      return
    }
    try {
      if (intent === 'signup') {
        setPendingIntent('phone')
        setMode('terms')
        return
      }
      const isExisting = await checkUserExists(e164, 'phone')
      if (!isExisting) {
        setPendingIntent('phone')
        setMode('terms')
        return
      }
      await sendOtp(e164)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function sendOtp(e164: string) {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: e164 }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Failed to send code.')
      return
    }
    setMode('otp')
  }

  async function handleTermsAccepted() {
    if (!termsAccepted) return
    setError('')
    setLoading(true)
    try {
      if (pendingIntent === 'email') {
        await sendMagicLink()
      } else if (pendingIntent === 'phone') {
        await sendOtp(formatPhone(phone))
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const e164 = formatPhone(phone)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164, code: otp }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; loginToken?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Incorrect code.')
        return
      }
      if (!data.loginToken) {
        setError('Sign-in failed. Please try again.')
        return
      }
      const result = await signIn('credentials', { loginToken: data.loginToken, redirect: false })
      if (result?.error) {
        setError('Sign-in failed. Please try again.')
        return
      }
      window.location.href = redirectTo
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDevBypass() {
    setLoading(true)
    const result = await signIn('dev-bypass', { email: 'mrock@gmail.com', redirect: false })
    if (result?.error) {
      setError('Dev bypass failed.')
      setLoading(false)
      return
    }
    window.location.href = redirectTo
  }

  // ── Choose ────────────────────────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <>
        {/* Heading */}
        <h1 className="auth-heading">
          {intent === 'signin' ? 'Welcome back.' : 'Create an account.'}
        </h1>
        <p className="auth-subhead">
          {intent === 'signin'
            ? 'Sign in to your StrikePoint account.'
            : 'Join StrikePoint and book your first session.'}
        </p>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${intent === 'signin' ? ' is-active' : ''}`}
            onClick={() => setIntent('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab${intent === 'signup' ? ' is-active' : ''}`}
            onClick={() => setIntent('signup')}
          >
            Create account
          </button>
        </div>

        <div className="auth-form">
          <OAuthButton
            provider="google"
            label={intent === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
            callbackUrl={redirectTo}
            icon={<GoogleIcon />}
          />
          <OAuthButton
            provider="apple"
            label={intent === 'signin' ? 'Continue with Apple' : 'Sign up with Apple'}
            callbackUrl={redirectTo}
            icon={<AppleIcon />}
          />

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
            <div className="auth-divider-line" />
          </div>

          <button type="button" className="auth-method-btn" onClick={() => setMode('email')}>
            {intent === 'signin' ? 'Continue with email' : 'Sign up with email'}
          </button>
          <button type="button" className="auth-method-btn" onClick={() => setMode('phone')}>
            {intent === 'signin' ? 'Continue with phone number' : 'Sign up with phone number'}
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="auth-dev-bypass">
            <button
              type="button"
              className="auth-dev-bypass-btn"
              disabled={loading}
              onClick={() => void handleDevBypass()}
            >
              {loading ? 'Signing in…' : '⚙ Dev: sign in as mrock@gmail.com'}
            </button>
          </div>
        )}
      </>
    )
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  if (mode === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
          {error && <span className="auth-input-error">{error}</span>}
        </div>
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? 'Sending link…' : 'Continue →'}
        </button>
        <button type="button" className="auth-back" onClick={() => { setMode('choose'); setError('') }}>
          ← Back
        </button>
      </form>
    )
  }

  // ── Phone ─────────────────────────────────────────────────────────────────

  if (mode === 'phone') {
    return (
      <form onSubmit={handlePhoneSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="auth-phone">Phone number</label>
          <input
            id="auth-phone"
            className="auth-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(203) 555-0100"
            autoFocus
            required
          />
          <span className="auth-input-hint">US numbers only. We&apos;ll send a 6-digit code.</span>
          {error && <span className="auth-input-error">{error}</span>}
        </div>
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? 'Sending code…' : 'Continue →'}
        </button>
        <button type="button" className="auth-back" onClick={() => { setMode('choose'); setError('') }}>
          ← Back
        </button>
      </form>
    )
  }

  // ── Terms (new account) ────────────────────────────────────────────────────

  if (mode === 'terms') {
    return (
      <div className="auth-form">
        <div className="auth-terms-card">
          <p className="auth-terms-eyebrow">Creating your account</p>
          <p className="auth-terms-body">
            {intent === 'signin' ? (
              <>
                We didn&apos;t find an account for{' '}
                <strong>{pendingIntent === 'email' ? email : phone}</strong>.
                {' '}A new account will be created.
              </>
            ) : (
              <>
                Creating a new account for{' '}
                <strong>{pendingIntent === 'email' ? email : phone}</strong>.
              </>
            )}
          </p>
        </div>

        <label className="auth-checkbox-label">
          <div className="relative flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
            />
            <div className={`auth-checkbox-box${termsAccepted ? ' is-checked' : ''}`}>
              {termsAccepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4.5 7.5L10 1" stroke="#A97845" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="auth-checkbox-text">
            I agree to the{' '}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </span>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button
          type="button"
          className="auth-submit-btn"
          disabled={!termsAccepted || loading}
          onClick={() => void handleTermsAccepted()}
        >
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
        <button
          type="button"
          className="auth-back"
          onClick={() => {
            setMode(pendingIntent ?? 'choose')
            setTermsAccepted(false)
            setError('')
          }}
        >
          ← Back
        </button>
      </div>
    )
  }

  // ── OTP entry ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleOtpSubmit} className="auth-form">
      <p className="auth-otp-hint">
        Enter the 6-digit code sent to <strong>{phone}</strong>
      </p>
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="auth-otp">Verification code</label>
        <input
          id="auth-otp"
          className="auth-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          autoFocus
          required
        />
        {error && <span className="auth-input-error">{error}</span>}
      </div>
      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? 'Verifying…' : 'Verify & sign in →'}
      </button>
      <button type="button" className="auth-back" onClick={() => { setMode('phone'); setOtp(''); setError('') }}>
        ← Resend code
      </button>
    </form>
  )
}

// ── OAuth button ──────────────────────────────────────────────────────────────

function OAuthButton({
  provider,
  label,
  callbackUrl,
  icon,
}: {
  provider: string
  label: string
  callbackUrl: string
  icon: React.ReactNode
}) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      type="button"
      className="auth-oauth-btn"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await signIn(provider, { callbackUrl })
      }}
    >
      {icon}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.3-57.2-155.3-127.8C46.7 790.7 0 663 0 541.8c0-207.5 135.4-317.3 268.6-317.3 99.8 0 167.2 61.6 224.3 61.6 54.7 0 132.1-65.2 246.7-65.2zm-84.7-123.1c-12.9 60.5-40.8 120.9-87.7 161.3-47 40.5-103.7 66.4-163.1 66.4-3.5 0-7-.3-10.4-.9 5.8-63.4 36.4-126.5 81.5-170.5 46.3-45.3 107.2-74.5 168.5-79.3 3.5-.3 6.9-.3 11.2-.3v23.3z"/>
    </svg>
  )
}
