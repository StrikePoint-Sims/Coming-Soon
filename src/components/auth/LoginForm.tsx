'use client'

import { use, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { checkUserExists } from '@/app/(auth)/login/actions'

type Mode = 'choose' | 'email' | 'phone' | 'terms' | 'otp'

interface LoginFormProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const { callbackUrl } = use(searchParams)
  const router = useRouter()
  const redirectTo = callbackUrl ?? '/account'

  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  // Pending intent while waiting for terms agreement
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
      const isExisting = await checkUserExists(email, 'email')
      if (!isExisting) {
        // New account — require terms agreement first
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
      // Dynamic callbackUrl — full navigation clears Next.js router cache cleanly
      window.location.href = redirectTo
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Choose ────────────────────────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-3">
        <OAuthButton
          provider="google"
          label="Continue with Google"
          callbackUrl={redirectTo}
          icon={<GoogleIcon />}
        />
        <OAuthButton
          provider="apple"
          label="Continue with Apple"
          callbackUrl={redirectTo}
          icon={<AppleIcon />}
        />

        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
          <span className="text-xs text-[rgba(255,255,255,0.22)] font-medium tracking-wide">or</span>
          <div className="flex-1 h-px bg-[rgba(255,255,255,0.08)]" />
        </div>

        <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode('email')}>
          Continue with email
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode('phone')}>
          Continue with phone number
        </Button>
      </div>
    )
  }

  // ── Email ─────────────────────────────────────────────────────────────────

  if (mode === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoFocus
          required
          error={error}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Continue →
        </Button>
        <button type="button" onClick={() => { setMode('choose'); setError('') }}
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
          ← Back
        </button>
      </form>
    )
  }

  // ── Phone ─────────────────────────────────────────────────────────────────

  if (mode === 'phone') {
    return (
      <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(203) 555-0100"
          autoFocus
          required
          hint="US numbers only. We'll send a 6-digit code."
          error={error}
        />
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Continue →
        </Button>
        <button type="button" onClick={() => { setMode('choose'); setError('') }}
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
          ← Back
        </button>
      </form>
    )
  }

  // ── Terms (new account only) ───────────────────────────────────────────────

  if (mode === 'terms') {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[#111] p-5">
          <p className="text-xs font-bold tracking-[0.13em] uppercase text-[rgba(255,255,255,0.3)] mb-3">
            Creating your account
          </p>
          <p className="text-sm text-[rgba(255,255,255,0.55)] leading-relaxed">
            We didn&apos;t find an account for{' '}
            <span className="text-white font-medium">
              {pendingIntent === 'email' ? email : phone}
            </span>
            . A new account will be created.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
            />
            <div className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-all duration-150 ${
              termsAccepted
                ? 'bg-[rgba(212,175,55,0.12)] border-[rgba(212,175,55,0.6)]'
                : 'border-[rgba(255,255,255,0.18)] group-hover:border-[rgba(255,255,255,0.35)]'
            }`}>
              {termsAccepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4.5 7.5L10 1" stroke="#D4AF37" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-[rgba(255,255,255,0.5)] leading-relaxed">
            I agree to the{' '}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer"
              className="text-[rgba(255,255,255,0.75)] underline underline-offset-2 hover:text-white">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer"
              className="text-[rgba(255,255,255,0.75)] underline underline-offset-2 hover:text-white">
              Privacy Policy
            </a>
          </span>
        </label>

        {error && <p className="text-sm text-[#e8735a]">{error}</p>}

        <Button
          size="lg"
          className="w-full"
          disabled={!termsAccepted}
          loading={loading}
          onClick={() => void handleTermsAccepted()}
        >
          Create account →
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode(pendingIntent ?? 'choose')
            setTermsAccepted(false)
            setError('')
          }}
          className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center"
        >
          ← Back
        </button>
      </div>
    )
  }

  // ── OTP entry ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-[rgba(255,255,255,0.6)] text-center">
        Enter the 6-digit code sent to <span className="text-white">{phone}</span>
      </p>
      <Input
        label="Verification code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoFocus
        required
        error={error}
      />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Verify & sign in
      </Button>
      <button type="button" onClick={() => { setMode('phone'); setOtp(''); setError('') }}
        className="text-xs text-[rgba(255,255,255,0.4)] hover:text-white text-center">
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
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        await signIn(provider, { callbackUrl })
      }}
      className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.8)] text-sm font-semibold hover:bg-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.18)] active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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
