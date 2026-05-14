export {}

declare global {
  interface Window {
    updatePrivacyPreferences: () => void
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
    fbq: (...args: unknown[]) => void
    _fbq: unknown
  }
}
