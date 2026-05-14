'use client'

export function PrivacySettingsButton() {
  return (
    <button
      className="sp-privacy-btn"
      onClick={() => window.updatePrivacyPreferences?.()}
    >
      Privacy Settings
    </button>
  )
}
