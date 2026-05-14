'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const STORAGE_KEY = 'sp_consent'

interface Consent {
  analytics: boolean
  ads: boolean
  timestamp: string
}

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Consent) : null
  } catch {
    return null
  }
}

function writeConsent(analytics: boolean, ads: boolean): Consent {
  const c: Consent = { analytics, ads, timestamp: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  return c
}

export function PrivacyConsent() {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [mounted, setMounted] = useState(false)
  const [bannerIn, setBannerIn] = useState(false)

  const showBanner = () => {
    setMounted(true)
    // One-tick delay so CSS transition fires after mount
    requestAnimationFrame(() => requestAnimationFrame(() => setBannerIn(true)))
  }

  const hideBanner = () => {
    setBannerIn(false)
    setTimeout(() => setMounted(false), 420)
  }

  const accept = () => {
    setConsent(writeConsent(true, true))
    hideBanner()
  }

  const decline = () => {
    setConsent(writeConsent(false, false))
    hideBanner()
  }

  useEffect(() => {
    const stored = readConsent()
    if (stored) {
      setConsent(stored)
    } else {
      const t = setTimeout(showBanner, 600)
      return () => clearTimeout(t)
    }
  }, [])

  // Register global so the "Privacy Settings" footer button can re-open the banner
  useEffect(() => {
    window.updatePrivacyPreferences = () => {
      localStorage.removeItem(STORAGE_KEY)
      setConsent(null)
      showBanner()
    }
  })

  const gaId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID']
  const metaId = process.env['NEXT_PUBLIC_META_PIXEL_ID']

  return (
    <>
      {/* GA4 — only loaded after analytics consent */}
      {consent?.analytics && gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}</Script>
        </>
      )}

      {/* Meta Pixel — only loaded after ads consent */}
      {consent?.ads && metaId && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${metaId}');fbq('track','PageView');
        `}</Script>
      )}

      {/* Consent banner */}
      {mounted && (
        <div
          id="sp-banner"
          className={bannerIn ? 'sp-banner--in' : ''}
          role="region"
          aria-label="Cookie consent"
        >
          <div className="sp-banner-inner">
            <p className="sp-banner-copy">
              We use cookies to improve the site and measure ads. This helps us understand
              what&apos;s working as we build StrikePoint.{' '}
              <a href="/privacy-policy" className="sp-banner-policy">Privacy Policy</a>
            </p>
            <div className="sp-banner-actions">
              <button className="sp-btn sp-btn--accept" onClick={accept}>Accept</button>
              <button className="sp-btn sp-btn--decline" onClick={decline}>Decline</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
