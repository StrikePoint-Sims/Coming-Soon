'use client'

import { signOut } from 'next-auth/react'

export function SettingsSignOut() {
  return (
    <div className="dash-section-card" style={{ textAlign: 'center' }}>
      <button
        className="dash-btn danger dash-btn-full"
        style={{ marginTop: 0 }}
        onClick={() => void signOut({ callbackUrl: '/' })}
      >
        Sign Out
      </button>
    </div>
  )
}
